import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import * as gameDb from 'game-db'
import { BattleRedis } from '../../datatypes/common/BattleRedis'
import { Skill } from 'game-db/dist/entity'
import { BattleCompletedService } from './battle-completed.service'
import { RulesService } from '../rules/rules.service'

/** ---------- helpers ---------- */

function ensureTurnTiming(battle: BattleRedis, graceMs: number) {
  const now = Date.now()
  const limit = battle.turnTimeLimit
  if (!battle.graceMs) battle.graceMs = graceMs

  if (!battle.turnEndsAtMs) {
    if (battle.turnStartTime) {
      battle.turnEndsAtMs = battle.turnStartTime + limit
    } else {
      battle.turnStartTime = now
      battle.turnEndsAtMs = now + limit
    }
  }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/**
 * Применяет активную защиту защищающегося к входящему урону:
 * 1) Сначала пытаемся уклониться (evasionMultiplier × baseEvasion -> шанс)
 * 2) Если не уклонились — блокируем (defenseMultiplier × baseDefense -> абсолютный блок)
 *
 * defenseMult, evasionMult — это множители из скилла защиты (может быть 0/undefined).
 * baseDefense, baseEvasion — базовые параметры монстра (из MonsterStats).
 */
function applyIncomingDefense(
  incomingDamage: number,
  baseDefense: number,
  baseEvasion: number,
  defenseMult?: number,
  evasionMult?: number,
): { damageAfter: number; block: number; evaded: boolean } {
  // 1) evasion check
  const evasionPower = (evasionMult ?? 0) * (baseEvasion ?? 0)
  const evasionChance = clamp(evasionPower / 100, 0, 0.95)
  if (Math.random() < evasionChance) {
    return { damageAfter: 0, block: 0, evaded: true }
  }

  // 2) block
  const blockAbs = Math.round((defenseMult ?? 0) * (baseDefense ?? 0))
  const after = Math.max(0, incomingDamage - blockAbs)
  return { damageAfter: after, block: blockAbs, evaded: false }
}

/** ---------- service ---------- */

@Injectable()
export class BattleAttackService {
  private server: Server
  constructor(
    @Inject('REDIS_CLIENT') readonly redisClient: Redis,
    readonly battleCompletedService: BattleCompletedService,
    private readonly rulesService: RulesService,
  ) {}
  setServer(server: Server) {
    this.server = server
  }

  private getAttack(battle: BattleRedis, monsterId: string, attackId: string | null): Partial<Skill> | null {
    if (!attackId) return null
    const isChallenger = monsterId === battle.challengerMonsterId
    return (isChallenger ? battle.challengerAttacks : battle.opponentAttacks)?.find((a) => a.id === attackId) ?? null
  }

  private getDefense(battle: BattleRedis, monsterId: string, defenseId: string | null): Partial<Skill> | null {
    if (!defenseId) return null
    const isChallenger = monsterId === battle.challengerMonsterId
    return (isChallenger ? battle.challengerDefenses : battle.opponentDefenses)?.find((d) => d.id === defenseId) ?? null
  }

  async attack(
    battleId: string,
    attackId: string | null,
    defenseId: string | null,
    monsterId: string,
  ): Promise<BattleRedis | null> {
    const key = `battle:${battleId}`
    const battleStr = await this.redisClient.get(key)
    if (!battleStr) return null

    const battle: BattleRedis = JSON.parse(battleStr) as BattleRedis
    if (battle.currentTurnMonsterId !== monsterId) return null

    const rules = await this.rulesService.getRules()
    ensureTurnTiming(battle, rules.battle.graceMs)

    // autopass by timer (NOT for first turn)
    const nowMs = Date.now()
    const endsAt = battle.turnEndsAtMs!
    const grace = battle.graceMs ?? rules.battle.graceMs
    const isFirstTurn = (battle.turnNumber ?? 0) === 0

    if (!isFirstTurn && nowMs > endsAt + grace) {
      attackId = null
      defenseId = null
    }

    const isChallenger = monsterId === battle.challengerMonsterId
    const defenderId = isChallenger ? battle.opponentMonsterId : battle.challengerMonsterId

    const selectedAttack = this.getAttack(battle, monsterId, attackId)
    const selectedDefense = this.getDefense(battle, monsterId, defenseId)

    // Current stamina of the attacker
    const stamina = isChallenger ? battle.challengerMonsterStamina : battle.opponentMonsterStamina
    const attackCost = selectedAttack?.energyCost ?? 0
    const defenseCost = selectedDefense?.energyCost ?? 0

    // We decide what we can do for SP (priority - attack):
    let doAttack = !!selectedAttack
    let doDefense = !!selectedDefense
    const totalCost = attackCost + defenseCost
    if (stamina < totalCost) {
      if (doAttack && stamina >= attackCost) {
        doDefense = false
      } else if (doDefense && stamina >= defenseCost) {
        doAttack = false
      } else {
        doAttack = false
        doDefense = false // PASS
      }
    }

    // Damage calculation (before incoming defense)
    const atkStat =
      (selectedAttack?.strength ?? 0) * (isChallenger ? battle.challengerStats.strength : battle.opponentStats.strength)
    let damage = doAttack ? Math.round(atkStat) : 0

    // We use ACTIVE protection of the defender (if any)
    // It was placed by him on the last turn (battle.activeDefense)
    let defenseBlock = 0
    let evaded = false
    if (doAttack && battle.activeDefense && battle.activeDefense.monsterId === defenderId) {
      const defenderStats = defenderId === battle.challengerMonsterId ? battle.challengerStats : battle.opponentStats

      const {
        damageAfter,
        block,
        evaded: ev,
      } = applyIncomingDefense(
        damage,
        defenderStats.defense,
        defenderStats.evasion,
        battle.activeDefense.action.defense,
        battle.activeDefense.action.evasion,
      )
      damage = damageAfter
      defenseBlock = block
      evaded = ev

      // we practice active defense once
      delete battle.activeDefense

      if (evaded) {
        // логируем сам факт уклонения (не добавляем урон/блок)
        battle.logs = battle.logs ?? []
        battle.logs.push({
          from: monsterId,
          to: defenderId,
          action: gameDb.datatypes.ActionStatusEnum.DEFENSE, // отдельного EVASION может не быть — пишем DEFENSE с effect
          nameAction: 'Уклонение',
          modifier: selectedAttack?.strength ?? 0,
          damage: 0,
          block: 0,
          effect: 'evasion',
          cooldown: 0,
          spCost: 0,
          turnSkip: 0,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Apply damage
    if (doAttack && !evaded) {
      if (isChallenger) {
        battle.opponentMonsterHp = Math.max(0, battle.opponentMonsterHp - damage)
      } else {
        battle.challengerMonsterHp = Math.max(0, battle.challengerMonsterHp - damage)
      }
    }

    // We put OUR defense on the next incoming blow (if defense is selected)
    if (doDefense && selectedDefense) {
      battle.activeDefense = {
        monsterId,
        action: {
          name: selectedDefense.name || '',
          defense: selectedDefense.defense ?? 0,
          evasion: selectedDefense.evasion ?? 0,
          cooldown: selectedDefense.cooldown ?? 0,
          energyCost: selectedDefense.energyCost ?? 0,
        },
      }
    }

    // === Update SP (with maximum limit)
    let addStamina = 0
    if (doAttack) addStamina += 1
    if (doDefense && !doAttack) addStamina += 2
    if (!doAttack && !doDefense) addStamina = 3

    const totalSpend = (doAttack ? attackCost : 0) + (doDefense ? defenseCost : 0)

    const currentSta = isChallenger ? battle.challengerMonsterStamina : battle.opponentMonsterStamina

    const maxSta = isChallenger ? battle.challengerStats.stamina : battle.opponentStats.stamina

    const nextSta = clamp(currentSta - totalSpend + addStamina, 0, maxSta)

    if (isChallenger) {
      battle.challengerMonsterStamina = nextSta
    } else {
      battle.opponentMonsterStamina = nextSta
    }

    // === Check winner
    let winnerMonsterId: string | null = null
    let loserMonsterId: string | null = null
    if (battle.challengerMonsterHp === 0) {
      winnerMonsterId = battle.opponentMonsterId
      loserMonsterId = battle.challengerMonsterId
    } else if (battle.opponentMonsterHp === 0) {
      winnerMonsterId = battle.challengerMonsterId
      loserMonsterId = battle.opponentMonsterId
    }

    // === ЛОГИ (защита, атака, пасс)
    battle.logs = battle.logs ?? []

    if (doDefense && selectedDefense) {
      battle.logs.push({
        from: monsterId,
        to: defenderId,
        action: gameDb.datatypes.ActionStatusEnum.DEFENSE,
        nameAction: selectedDefense.name || '',
        // для истории кладём то, что реально будем применять на входящий удар
        modifier: selectedDefense.defense ?? 0, // множитель блока (совместимость)
        damage: 0,
        block: 0,
        effect: (selectedDefense.evasion ?? 0) > 0 ? 'evasion_ready' : undefined,
        cooldown: selectedDefense.cooldown ?? 0,
        spCost: selectedDefense.energyCost ?? 0,
        turnSkip: 0,
        timestamp: new Date().toISOString(),
      })
    }

    if (doAttack && selectedAttack) {
      battle.logs.push({
        from: monsterId,
        to: defenderId,
        action: gameDb.datatypes.ActionStatusEnum.ATTACK,
        nameAction: selectedAttack.name || '',
        modifier: selectedAttack.strength,
        damage: evaded ? 0 : damage,
        block: evaded ? 0 : defenseBlock,
        effect: evaded ? 'evaded' : undefined,
        cooldown: selectedAttack.cooldown ?? 0,
        spCost: selectedAttack.energyCost ?? 0,
        turnSkip: 0,
        timestamp: new Date().toISOString(),
      })
    }

    if (!doAttack && !doDefense) {
      battle.logs.push({
        from: monsterId,
        to: defenderId,
        action: gameDb.datatypes.ActionStatusEnum.PASS,
        nameAction: 'Пропуск',
        modifier: 0,
        damage: 0,
        block: 0,
        effect: undefined,
        cooldown: 0,
        spCost: 0,
        turnSkip: 1,
        timestamp: new Date().toISOString(),
      })
    }

    // lastActionLog — для быстрых всплывашек на UI
    battle.lastActionLog = {
      monsterId,
      actionName: doAttack
        ? selectedAttack?.name || 'Атака'
        : doDefense
          ? selectedDefense?.name || 'Защита'
          : 'Пропуск',
      damage: doAttack && !evaded ? damage : 0,
      stamina: addStamina,
    }

    // Transition of the move and timings
    battle.currentTurnMonsterId = defenderId
    battle.turnNumber = (battle.turnNumber ?? 0) + 1
    const nextDuration = battle.turnTimeLimit ?? rules.battle.maxTurnsMs
    const t0 = Date.now()
    battle.turnStartTime = t0
    battle.turnEndsAtMs = t0 + nextDuration
    battle.graceMs = battle.graceMs ?? rules.battle.graceMs
    battle.serverNowMs = Date.now()

    if (winnerMonsterId && loserMonsterId) {
      await this.battleCompletedService.endBattle(battle, winnerMonsterId, loserMonsterId, battleId)
    }

    await this.redisClient.set(`battle:${battleId}`, JSON.stringify(battle), 'EX', rules.battle.ttlBattleSec)

    return battle
  }
}
