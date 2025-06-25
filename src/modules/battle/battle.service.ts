import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import { BattleRedis } from '../../datatypes/common/BattleRedis'
import { createBattleToRedis } from '../../functions/create-battle'
import * as gameDb from 'game-db'
import { fetchRequest } from '../../functions/fetchRequest'
import config from 'src/config'

export function mapBattleRedisRaw(battleRaw: Record<string, string>): BattleRedis {
  return {
    battleId: battleRaw.battleId,
    challengerMonsterId: battleRaw.challengerMonsterId,
    opponentMonsterId: battleRaw.opponentMonsterId,
    challengerMonsterHp: parseInt(battleRaw.challengerMonsterHp),
    opponentMonsterHp: parseInt(battleRaw.opponentMonsterHp),
    currentTurnMonsterId: battleRaw.currentTurnMonsterId,
    turnStartTime: parseInt(battleRaw.turnStartTime),
    turnTimeLimit: parseInt(battleRaw.turnTimeLimit),
    lastActionLog: battleRaw.lastActionLog,
    challengerSocketId: battleRaw.challengerSocketId || '',
    opponentSocketId: battleRaw.opponentSocketId || '',
    challengerReady: battleRaw.challengerReady === '1' ? '1' : '0',
    opponentReady: battleRaw.opponentReady === '1' ? '1' : '0',
    chatId: battleRaw.chatId,
  }
}

@Injectable()
export class BattleService {
  private server: Server

  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

  setServer(server: Server) {
    this.server = server
  }

  async getBattle(battleId: string, monsterId: string, socketId: string): Promise<BattleRedis | null> {
    const key = `battle:${battleId}`
    let battleRaw = await this.redisClient.hgetall(key)
    if (!battleRaw || Object.keys(battleRaw).length === 0) {
      //CREATE BATTLE if has in db (if battle created in bot)
      const battleDb = await gameDb.Entities.MonsterBattles.findOne({
        where: { id: battleId, status: gameDb.datatypes.BattleStatusEnum.ACCEPTED },
      })
      if (!battleDb) {
        return null
      }

      await createBattleToRedis({
        redisClient: this.redisClient,
        newBattle: battleDb,
        challengerSocketId: battleDb.challengerMonsterId === monsterId ? socketId : '',
        opponentSocketId: battleDb.opponentMonsterId === monsterId ? socketId : '',
        chatId: battleDb.chatId,
      })

      battleRaw = await this.redisClient.hgetall(key)
    }

    const isChallenger = battleRaw.challengerMonsterId === monsterId
    const isOpponent = battleRaw.opponentMonsterId === monsterId

    if (!isChallenger && !isOpponent) return null

    const updates: Record<string, string> = {}
    if (isChallenger) {
      updates.challengerSocketId = socketId
      updates.challengerReady = '0'
    } else {
      updates.opponentSocketId = socketId
      updates.opponentReady = '0'
    }

    await this.redisClient.hset(key, updates)

    const updatedBattleRaw = {
      ...battleRaw,
      ...updates,
    }

    return mapBattleRedisRaw(updatedBattleRaw)
  }

  async startBattle(battleId: string, monsterId: string, socketId: string): Promise<BattleRedis | null> {
    const battleRaw = await this.redisClient.hgetall(`battle:${battleId}`)
    if (!battleRaw || Object.keys(battleRaw).length === 0) return null

    const battle = mapBattleRedisRaw(battleRaw)

    if (monsterId === battle.challengerMonsterId) {
      battle.challengerSocketId = socketId
      battle.challengerReady = '1'
    } else if (monsterId === battle.opponentMonsterId) {
      battle.opponentSocketId = socketId
      battle.opponentReady = '1'
    } else {
      return null
    }

    await this.redisClient.hset(`battle:${battleId}`, {
      challengerSocketId: battle.challengerSocketId,
      opponentSocketId: battle.opponentSocketId,
      challengerReady: battle.challengerReady,
      opponentReady: battle.opponentReady,
    })

    return battle
  }

  async attack(battleId: string, damage: number, monsterId: string, socketId: string): Promise<BattleRedis | null> {
    const key = `battle:${battleId}`
    const battleRaw = await this.redisClient.hgetall(key)
    if (!battleRaw || Object.keys(battleRaw).length === 0) return null

    const battle = mapBattleRedisRaw(battleRaw)

    if (battle.currentTurnMonsterId !== monsterId) return null

    const timestamp = new Date().toISOString()

    const isChallenger = monsterId === battle.challengerMonsterId
    const defenderId = isChallenger ? battle.opponentMonsterId : battle.challengerMonsterId

    if (isChallenger) {
      battle.opponentMonsterHp = Math.max(0, battle.opponentMonsterHp - damage)
    } else {
      battle.challengerMonsterHp = Math.max(0, battle.challengerMonsterHp - damage)
    }

    let winner: string | null = null

    if (battle.challengerMonsterHp === 0) {
      winner = battle.opponentMonsterId
    } else if (battle.opponentMonsterHp === 0) {
      winner = battle.challengerMonsterId
    }

    battle.currentTurnMonsterId = defenderId
    battle.turnStartTime = Date.now()
    battle.turnTimeLimit = 30000

    const logEntry = {
      timestamp,
      action: `Монстр ${monsterId} нанёс ${damage} урона`,
      from: monsterId,
      to: defenderId,
      damage,
    }

    const logs = battleRaw.logs ? JSON.parse(battleRaw.logs) : []
    logs.push(logEntry)

    battle.lastActionLog = logEntry.action

    const redisUpdatePayload = {
      challengerMonsterHp: battle.challengerMonsterHp,
      opponentMonsterHp: battle.opponentMonsterHp,
      currentTurnMonsterId: battle.currentTurnMonsterId,
      turnStartTime: battle.turnStartTime,
      turnTimeLimit: battle.turnTimeLimit,
      lastActionLog: battle.lastActionLog,
      logs: JSON.stringify(logs),
      ...(battle.winnerMonsterId ? { winnerMonsterId: battle.winnerMonsterId } : {}),
    }

    if (winner) {
      battle.winnerMonsterId = winner
      redisUpdatePayload.winnerMonsterId = winner

      await gameDb.Entities.MonsterBattles.update(battleId, {
        status: gameDb.datatypes.BattleStatusEnum.FINISHED,
        winnerMonsterId: winner,
        log: logs,
      })
      if (battle.chatId) {
        fetchRequest({
          url: `http://${config.botServiceUrl}/result-battle/${battleId}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${config.botServiceToken}` },
        })
      }
    }

    await this.redisClient.hset(key, redisUpdatePayload)
    await this.redisClient.expire(key, 1800)

    return {
      ...battle,
      logs,
    }
  }
}
