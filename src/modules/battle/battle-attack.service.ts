import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import * as gameDb from 'game-db'
import { fetchRequest } from '../../functions/fetchRequest'
import config from '../../config'
import { logBattle, logger } from '../../functions/logger'
import { BattleRedis } from '../../datatypes/common/BattleRedis'
import { updateExpMonster } from '../../functions/updateExpMonster'
import { updateEnergy } from '../../functions/update-energy'
import { updateFood } from '../../functions/update-food'
import { battleExpRewards } from '../../config/monster-starting-stats'
import { Skill } from 'game-db/dist/entity'
import { DEFAULT_GRACE_MS, DEFAULT_TURN_MS, SATIETY_COST } from '../../config/battle'

/** ---------- helpers ---------- */

function ensureTurnTiming(battle: BattleRedis) {
  const now = Date.now()
  const limit = battle.turnTimeLimit ?? DEFAULT_TURN_MS
  if (!battle.graceMs) battle.graceMs = DEFAULT_GRACE_MS

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
  constructor(@Inject('REDIS_CLIENT') readonly redisClient: Redis) {}
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

    ensureTurnTiming(battle)

    // автопасс по таймеру
    const nowMs = Date.now()
    const endsAt = battle.turnEndsAtMs!
    const grace = battle.graceMs ?? DEFAULT_GRACE_MS
    if (nowMs > endsAt + grace) {
      attackId = null
      defenseId = null
    }

    const isChallenger = monsterId === battle.challengerMonsterId
    const defenderId = isChallenger ? battle.opponentMonsterId : battle.challengerMonsterId

    const selectedAttack = this.getAttack(battle, monsterId, attackId)
    const selectedDefense = this.getDefense(battle, monsterId, defenseId)

    // Текущая выносливость атакующего
    const stamina = isChallenger ? battle.challengerMonsterStamina : battle.opponentMonsterStamina
    const attackCost = selectedAttack?.energyCost ?? 0
    const defenseCost = selectedDefense?.energyCost ?? 0

    // Решаем, что можем выполнить по SP (приоритет — атака):
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

    // === Расчёт урона (до входящей защиты)
    const atkStat =
      (selectedAttack?.strength ?? 0) * (isChallenger ? battle.challengerStats.strength : battle.opponentStats.strength)
    let damage = doAttack ? Math.round(atkStat) : 0

    // === Применяем АКТИВНУЮ защиту защищающегося (если есть)
    // Она ставилась им на прошлом ходу (battle.activeDefense)
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

      // активную защиту отрабатываем 1 раз
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

    // === Применяем урон
    if (doAttack && !evaded) {
      if (isChallenger) {
        battle.opponentMonsterHp = Math.max(0, battle.opponentMonsterHp - damage)
      } else {
        battle.challengerMonsterHp = Math.max(0, battle.challengerMonsterHp - damage)
      }
    }

    // === Ставим СВОЮ защиту на следующий входящий удар (если выбрана защита)
    if (doDefense && selectedDefense) {
      battle.activeDefense = {
        monsterId,
        action: {
          name: selectedDefense.name || '',
          // важное: используем defense как множитель блока
          defense: selectedDefense.defense ?? 0,
          // и evasion как множитель шанса уклонения
          evasion: selectedDefense.evasion ?? 0,
          cooldown: selectedDefense.cooldown ?? 0,
          energyCost: selectedDefense.energyCost ?? 0,
        },
      }
    }

    // === Обновляем SP
    let addStamina = 0
    if (doAttack) addStamina += 1
    if (doDefense && !doAttack) addStamina += 2
    if (!doAttack && !doDefense) addStamina = 3

    const totalSpend = (doAttack ? attackCost : 0) + (doDefense ? defenseCost : 0)
    if (isChallenger) {
      battle.challengerMonsterStamina = Math.max(0, battle.challengerMonsterStamina - totalSpend + addStamina)
    } else {
      battle.opponentMonsterStamina = Math.max(0, battle.opponentMonsterStamina - totalSpend + addStamina)
    }

    // === Проверка победителя
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

    // === Переход хода и тайминги
    battle.currentTurnMonsterId = defenderId
    battle.turnNumber = (battle.turnNumber ?? 0) + 1
    const nextDuration = battle.turnTimeLimit ?? DEFAULT_TURN_MS
    const t0 = Date.now()
    battle.turnStartTime = t0
    battle.turnEndsAtMs = t0 + nextDuration
    battle.graceMs = battle.graceMs ?? DEFAULT_GRACE_MS
    battle.serverNowMs = Date.now()

    // === Завершение боя (твоя логика сохранена)
    if (winnerMonsterId && loserMonsterId) {
      await this.endBattle(battle, winnerMonsterId, loserMonsterId, battleId)
    }

    // Сохраняем, не сбрасывая TTL
    await this.redisClient.set(key, JSON.stringify(battle), 'KEEPTTL')
    return battle
  }

  /**
   * Завершает бой, обновляет БД, начисляет награды и т.д.
   */
  async endBattle(battle: BattleRedis, winnerMonsterId: string, loserMonsterId: string, battleId: string) {
    battle.winnerMonsterId = winnerMonsterId

    const manager = gameDb.AppDataSource.manager

    await gameDb.Entities.MonsterBattles.update(battleId, {
      status: gameDb.datatypes.BattleStatusEnum.FINISHED,
      winnerMonsterId,
      log: battle.logs,
    })

    updateExpMonster(winnerMonsterId, loserMonsterId, battleExpRewards.winExp, battleExpRewards.loseExp).catch(
      (error) => {
        logger.error(`Failed to update experience for winner ${winnerMonsterId} or loser ${loserMonsterId}:`, error)
      },
    )

    logBattle.info('battle', {
      battleId,
      winnerMonsterId,
      challengerMonsterId: battle.challengerMonsterId,
      opponentMonsterId: battle.opponentMonsterId,
      challengerStats: battle.challengerStats,
      opponentStats: battle.opponentStats,
      challengerFinalHp: battle.challengerMonsterHp,
      opponentFinalHp: battle.opponentMonsterHp,
      challengerFinalSp: battle.challengerMonsterStamina,
      opponentFinalSp: battle.opponentMonsterStamina,
      finishedAt: new Date().toISOString(),
      logCount: battle.logs?.length ?? 0,
    })

    battle.logs?.forEach((log, index) => {
      logBattle.info('battle-turn', { battleId, turn: index + 1, ...log })
    })

    await manager
      .createQueryBuilder()
      .update(gameDb.Entities.Monster)
      .set({ satiety: () => `GREATEST(satiety - ${SATIETY_COST}, 0)` })
      .where('id IN (:...ids)', { ids: [battle.challengerMonsterId, battle.opponentMonsterId] })
      .execute()

    const foodRepo = gameDb.AppDataSource.getRepository(gameDb.Entities.Food)
    const foods = await foodRepo.find()
    if (!foods.length) {
      logger.error('No food found in database')
    } else {
      const food = foods[Math.floor(Math.random() * foods.length)]

      const challengerUser = await manager.findOne(gameDb.Entities.User, { where: { id: battle.challengerUserId } })
      const opponentUser = await manager.findOne(gameDb.Entities.User, { where: { id: battle.opponentUserId } })

      if (challengerUser && opponentUser) {
        await Promise.all([updateEnergy(challengerUser, manager, -125), updateEnergy(opponentUser, manager, -125)])

        const foodQuantity = Math.floor(Math.random() * 2) + 1

        if (winnerMonsterId === battle.challengerMonsterId) {
          await updateFood(challengerUser, manager, food.id, foodQuantity)
          battle.challengerGetReward = {
            exp: battleExpRewards.winExp,
            food: { id: food.id, name: food.name, quantity: foodQuantity },
          }
          battle.opponentGetReward = { exp: battleExpRewards.loseExp }
        } else {
          await updateFood(opponentUser, manager, food.id, foodQuantity)
          battle.challengerGetReward = { exp: battleExpRewards.loseExp }
          battle.opponentGetReward = {
            exp: battleExpRewards.winExp,
            food: { id: food.id, name: food.name, quantity: foodQuantity },
          }
        }
      } else {
        if (!challengerUser) logger.error('Challenger user not found')
        if (!opponentUser) logger.error('Opponent user not found')
      }
    }

    if (battle.chatId) {
      fetchRequest({
        url: `http://${config.botServiceUrl}/result-battle/${battleId}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${config.botServiceToken}` },
      }).catch((error) => logger.error('Fetch result battle', error))
    }
  }
}
