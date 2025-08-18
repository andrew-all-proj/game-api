import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import { createBattleToRedis } from '../../functions/create-battle'
import * as gameDb from 'game-db'
import { BattleRedis } from '../../datatypes/common/BattleRedis'
import { Skill } from '../skill/entities/skill'

function applyDefense(
  attackDamage: number,
  defenderStats: { defense: number; evasion: number },
  defenseSkill: Partial<Skill> | null,
): { damageAfter: number; block: number; evaded: boolean } {
  if (!defenseSkill) {
    // защиты нет → получаем весь урон
    return { damageAfter: attackDamage, block: 0, evaded: false }
  }

  let block = 0
  let evaded = false

  // Проверка уклонения
  const evasionPower = (defenseSkill.evasion ?? 0) * defenderStats.evasion
  const evasionChance = Math.min(0.95, evasionPower / 100) // ограничим до 95%
  if (Math.random() < evasionChance) {
    return { damageAfter: 0, block: 0, evaded: true }
  }

  // Проверка блока
  const defensePower = (defenseSkill.defense ?? 0) * defenderStats.defense
  block = Math.round(defensePower)
  const damageAfter = Math.max(0, attackDamage - block)

  return { damageAfter, block, evaded }
}

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
      battle.challengerReady = '0'
    } else {
      battle.opponentSocketId = socketId
      battle.opponentReady = '0'
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
      battle.challengerReady = '1'
    } else if (monsterId === battle.opponentMonsterId) {
      battle.opponentSocketId = socketId
      battle.opponentReady = '1'
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
