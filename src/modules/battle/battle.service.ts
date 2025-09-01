import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import { createBattleToRedis } from '../../functions/create-battle'
import * as gameDb from 'game-db'
import { BattleRedis } from '../../datatypes/common/BattleRedis'
import {
  DEFAULT_GRACE_MS,
  DEFAULT_TURN_MS,
  FIRST_TURN_EXTRA_MS,
  MAX_MISSED_TURNS,
  PASS_GAIN,
  TTL_BATTLE,
} from '../../config/battle'
import { BattleAttackService } from './battle-attack.service'
import { BattleCompletedService } from './battle-completed.service'

@Injectable()
export class BattleService {
  private server: Server

  constructor(
    @Inject('REDIS_CLIENT') readonly redisClient: Redis,
    private readonly attackService: BattleAttackService,
    private readonly battleCompletedService: BattleCompletedService,
  ) {}

  setServer(server: Server) {
    this.server = server
  }

  async getBattle(battleId: string, monsterId: string, socketId: string): Promise<BattleRedis | null> {
    const key = `battle:${battleId}`

    let battleStr = await this.redisClient.get(key)
    if (!battleStr) {
      // CREATE BATTLE if has in db (if battle created in bot)
      const battleDb = await gameDb.Entities.MonsterBattles.findOne({
        where: { id: battleId, status: gameDb.datatypes.BattleStatusEnum.ACCEPTED },
      })
      if (!battleDb) return null

      const battle = await createBattleToRedis({
        redisClient: this.redisClient,
        newBattle: battleDb,
        challengerSocketId: battleDb.challengerMonsterId === monsterId ? socketId : '',
        opponentSocketId: battleDb.opponentMonsterId === monsterId ? socketId : '',
        chatId: battleDb.chatId,
      })

      if (!battle) {
        return null
      }

      battleStr = await this.redisClient.get(key)
      if (!battleStr) return null
    }

    const battle: BattleRedis = JSON.parse(battleStr) as BattleRedis

    const isChallenger = battle.challengerMonsterId === monsterId
    const isOpponent = battle.opponentMonsterId === monsterId

    if (!isChallenger && !isOpponent) return null

    if (isChallenger) {
      battle.challengerSocketId = socketId
      battle.challengerReady = false
    } else {
      battle.opponentSocketId = socketId
      battle.opponentReady = false
    }

    await this.redisClient.set(`battle:${battleId}`, JSON.stringify(battle), 'EX', TTL_BATTLE)

    return battle
  }

  async startBattle(battleId: string, monsterId: string, socketId: string): Promise<BattleRedis | null> {
    const battleRaw = await this.redisClient.get(`battle:${battleId}`)
    if (!battleRaw) return null

    const battle: BattleRedis = JSON.parse(battleRaw) as BattleRedis

    if (monsterId === battle.challengerMonsterId) {
      battle.challengerSocketId = socketId
      battle.challengerReady = true
    } else if (monsterId === battle.opponentMonsterId) {
      battle.opponentSocketId = socketId
      battle.opponentReady = true
    } else {
      return null
    }

    await this.redisClient.set(`battle:${battleId}`, JSON.stringify(battle), 'EX', TTL_BATTLE)

    return battle
  }

  async rejectBattle(battleId: string) {
    gameDb.Entities.MonsterBattles.update(
      { id: battleId },
      {
        status: gameDb.datatypes.BattleStatusEnum.REJECTED,
      },
    )
  }

  async statusBattle(battleId: string): Promise<BattleRedis | null> {
    const key = `battle:${battleId}`
    const raw = await this.redisClient.get(key)
    if (!raw) return null

    const battle: BattleRedis = JSON.parse(raw)
    if (battle.winnerMonsterId) return battle

    const limit = battle.turnTimeLimit ?? DEFAULT_TURN_MS
    const grace = battle.graceMs ?? DEFAULT_GRACE_MS

    if (!battle.turnStartTime || !battle.turnEndsAtMs) {
      const now = Date.now()
      battle.turnStartTime = battle.turnStartTime ?? now
      battle.turnEndsAtMs = battle.turnEndsAtMs ?? now + limit
    }

    const isFirstTurn = (battle.turnNumber ?? 0) === 0
    const now = Date.now()

    // on the first move we wait 15s longer before autopass
    const extra = isFirstTurn ? FIRST_TURN_EXTRA_MS : 0
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
    const nextSta = Math.min(maxSta, curSta + PASS_GAIN)
    if (isCh) battle.challengerMonsterStamina = nextSta
    else battle.opponentMonsterStamina = nextSta

    // timeout counter
    if (isCh) battle.challengerMissedTurns = (battle.challengerMissedTurns ?? 0) + 1
    else battle.opponentMissedTurns = (battle.opponentMissedTurns ?? 0) + 1

    const misses = isCh ? (battle.challengerMissedTurns ?? 0) : (battle.opponentMissedTurns ?? 0)
    if (misses >= (MAX_MISSED_TURNS ?? 3)) {
      // technical loss
      const winner = oppId
      const loser = skipperId
      await this.battleCompletedService.endBattle(battle, winner, loser, battleId)
      await this.redisClient.set(key, JSON.stringify(battle), 'EX', TTL_BATTLE)
      return battle
    }

    // transition of the move
    const t0 = Date.now()
    battle.currentTurnMonsterId = oppId
    battle.turnNumber = (battle.turnNumber ?? 0) + 1
    battle.turnStartTime = t0
    battle.turnEndsAtMs = t0 + limit
    battle.serverNowMs = Date.now()

    await this.redisClient.set(key, JSON.stringify(battle), 'EX', TTL_BATTLE)

    return battle
  }
}
