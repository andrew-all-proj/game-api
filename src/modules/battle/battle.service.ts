import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import { createBattleToRedis } from '../../functions/create-battle'
import * as gameDb from 'game-db'
import { BattleRedis } from '../../datatypes/common/BattleRedis'

@Injectable()
export class BattleService {
  private server: Server

  constructor(@Inject('REDIS_CLIENT') readonly redisClient: Redis) {}

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

    await this.redisClient.set(key, JSON.stringify(battle), 'KEEPTTL')

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

    await this.redisClient.set(`battle:${battleId}`, JSON.stringify(battle), 'KEEPTTL')

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
}
