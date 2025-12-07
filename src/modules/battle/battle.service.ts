import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import { createBattle } from '../../functions/create-battle'
import * as gameDb from 'game-db'
import { BattleRedis } from '../../datatypes/common/BattleRedis'
import { BattleCompletedService } from './battle-completed.service'
import { logger } from 'src/functions/logger'
import { RulesService } from '../rules/rules.service'

@Injectable()
export class BattleService {
  private server: Server

  constructor(
    @Inject('REDIS_CLIENT') readonly redisClient: Redis,
    private readonly battleCompletedService: BattleCompletedService,
    private readonly rulesService: RulesService,
  ) {}

  setServer(server: Server) {
    this.server = server
  }

  async getBattle(battleId: string, monsterId: string, _socketId: string): Promise<BattleRedis | null> {
    const key = `battle:${battleId}`

    const battleStr = await this.redisClient.get(key)
    if (!battleStr) {
      await this.rejectBattle(battleId)
      logger.error('Battle not foun in redis')
      return null
    }

    const battle: BattleRedis = JSON.parse(battleStr) as BattleRedis

    const isChallenger = battle.challengerMonsterId === monsterId
    const isOpponent = battle.opponentMonsterId === monsterId

    if (!isChallenger && !isOpponent) return null

    if (isChallenger) {
      battle.challengerReady = false
    } else {
      battle.opponentReady = false
    }

    const rules = await this.rulesService.getRules()
    await this.redisClient.set(`battle:${battleId}`, JSON.stringify(battle), 'EX', rules.battle.ttlBattleSec)

    return battle
  }

  async startBattle(battleId: string, monsterId: string, _socketId: string): Promise<BattleRedis | null> {
    const battleRaw = await this.redisClient.get(`battle:${battleId}`)
    if (!battleRaw) return null

    const battle: BattleRedis = JSON.parse(battleRaw) as BattleRedis

    if (monsterId === battle.challengerMonsterId) {
      battle.challengerReady = true
    } else if (monsterId === battle.opponentMonsterId) {
      battle.opponentReady = true
    } else {
      return null
    }

    const rules = await this.rulesService.getRules()
    await this.redisClient.set(`battle:${battleId}`, JSON.stringify(battle), 'EX', rules.battle.ttlBattleSec)

    return battle
  }

  async rejectBattle(battleId: string) {
    await gameDb.Entities.MonsterBattles.update(
      { id: battleId },
      {
        status: gameDb.datatypes.BattleStatusEnum.REJECTED,
      },
    )
  }

  async statusBattle(battleId: string): Promise<BattleRedis | null> {
    const rules = await this.rulesService.getRules()
    const key = `battle:${battleId}`
    const raw = await this.redisClient.get(key)
    if (!raw) return null

    const parsedBattle = JSON.parse(raw) as unknown
    if (!parsedBattle || typeof parsedBattle !== 'object') return null
    const battle = parsedBattle as BattleRedis
    if (battle.winnerMonsterId) return battle

    const limit = battle.turnTimeLimit ?? rules.battle.maxTurnsMs
    const grace = battle.graceMs ?? rules.battle.graceMs

    if (!battle.turnStartTime || !battle.turnEndsAtMs) {
      const now = Date.now()
      battle.turnStartTime = battle.turnStartTime ?? now
      battle.turnEndsAtMs = battle.turnEndsAtMs ?? now + limit
    }

    const isFirstTurn = (battle.turnNumber ?? 0) === 0
    const now = Date.now()

    // on the first move we wait 15s longer before autopass
    const extra = isFirstTurn ? rules.battle.firstTurnExtraSec : 0
    if (now <= battle.turnEndsAtMs + grace + extra) {
      return battle
    }

    // whose turn is overdue
    const skipperId = battle.currentTurnMonsterId
    const oppId = skipperId === battle.challengerMonsterId ? battle.opponentMonsterId : battle.challengerMonsterId

    // PASS log
    battle.logs = battle.logs ?? []
    battle.logs.push({
      from: skipperId,
      to: oppId,
      action: gameDb.datatypes.ActionStatusEnum.PASS,
      nameAction: 'Пропуск (таймаут)',
      modifier: 0,
      damage: 0,
      block: 0,
      effect: 'timeout',
      cooldown: 0,
      spCost: 0,
      turnSkip: 1,
      timestamp: new Date().toISOString(),
    })

    // +3 SP с капом по максимуму
    const isCh = skipperId === battle.challengerMonsterId
    const curSta = isCh ? battle.challengerMonsterStamina : battle.opponentMonsterStamina
    const maxSta = isCh ? battle.challengerStats.stamina : battle.opponentStats.stamina
    const nextSta = Math.min(maxSta, curSta + rules.battle.passGain)
    if (isCh) battle.challengerMonsterStamina = nextSta
    else battle.opponentMonsterStamina = nextSta

    // timeout counter
    if (isCh) battle.challengerMissedTurns = (battle.challengerMissedTurns ?? 0) + 1
    else battle.opponentMissedTurns = (battle.opponentMissedTurns ?? 0) + 1

    const misses = isCh ? (battle.challengerMissedTurns ?? 0) : (battle.opponentMissedTurns ?? 0)
    if (misses >= rules.battle.maxMissedTurns) {
      // technical loss
      const winner = oppId
      const loser = skipperId
      await this.battleCompletedService.endBattle(battle, winner, loser, battleId)
      await this.redisClient.set(key, JSON.stringify(battle), 'EX', rules.battle.ttlBattleSec)
      return battle
    }

    // transition of the move
    const t0 = Date.now()
    battle.currentTurnMonsterId = oppId
    battle.turnNumber = (battle.turnNumber ?? 0) + 1
    battle.turnStartTime = t0
    battle.turnEndsAtMs = t0 + limit
    battle.serverNowMs = Date.now()

    await this.redisClient.set(key, JSON.stringify(battle), 'EX', rules.battle.ttlBattleSec)

    return battle
  }

  async createBattle(opponentMonsterId: string, challengerMonsterId: string, chatId?: string): Promise<string | null> {
    const battle = await createBattle({ redisClient: this.redisClient, opponentMonsterId, challengerMonsterId, chatId })

    return battle.battleId
  }

  async getUserSocketId(userId: string): Promise<string | null> {
    const socketId = await this.redisClient.hget(`user:${userId}`, 'socketId')
    return socketId
  }
}
