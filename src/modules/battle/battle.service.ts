import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import { createBattleToRedis } from '../../functions/create-battle'
import * as gameDb from 'game-db'
import { fetchRequest } from '../../functions/fetchRequest'
import config from '../../config'
import { logger } from '../../functions/logger'
import { BattleRedis, MonsterAttack, MonsterDefense, MonsterStats } from '../../datatypes/common/BattleRedis'

export function mapBattleRedisRaw(battleRaw: Record<string, string>): BattleRedis {
  return {
    battleId: battleRaw.battleId,
    challengerMonsterId: battleRaw.challengerMonsterId,
    opponentMonsterId: battleRaw.opponentMonsterId,
    challengerMonsterHp: parseInt(battleRaw.challengerMonsterHp),
    opponentMonsterHp: parseInt(battleRaw.opponentMonsterHp),

    challengerMonsterStamina: parseInt(battleRaw.challengerMonsterStamina),
    opponentMonsterStamina: parseInt(battleRaw.opponentMonsterStamina),

    challengerStats: battleRaw.challengerStats
      ? (JSON.parse(battleRaw.challengerStats) as MonsterStats)
      : {
          healthPoints: 0,
          stamina: 0,
          strength: 0,
          defense: 0,
          evasion: 0,
        },

    opponentStats: battleRaw.opponentStats
      ? (JSON.parse(battleRaw.opponentStats) as MonsterStats)
      : {
          healthPoints: 0,
          stamina: 0,
          strength: 0,
          defense: 0,
          evasion: 0,
        },

    challengerAttacks: battleRaw.challengerAttacks ? (JSON.parse(battleRaw.challengerAttacks) as MonsterAttack[]) : [],

    challengerDefenses: battleRaw.challengerDefenses
      ? (JSON.parse(battleRaw.challengerDefenses) as MonsterDefense[])
      : [],

    opponentAttacks: battleRaw.opponentAttacks ? (JSON.parse(battleRaw.opponentAttacks) as MonsterAttack[]) : [],

    opponentDefenses: battleRaw.opponentDefenses ? (JSON.parse(battleRaw.opponentDefenses) as MonsterDefense[]) : [],

    currentTurnMonsterId: battleRaw.currentTurnMonsterId,
    turnStartTime: parseInt(battleRaw.turnStartTime),
    turnTimeLimit: parseInt(battleRaw.turnTimeLimit),
    lastActionLog: battleRaw.lastActionLog,
    challengerSocketId: battleRaw.challengerSocketId || '',
    opponentSocketId: battleRaw.opponentSocketId || '',
    challengerReady: battleRaw.challengerReady === '1' ? '1' : '0',
    opponentReady: battleRaw.opponentReady === '1' ? '1' : '0',
    chatId: battleRaw.chatId || null,

    activeDefense: battleRaw.activeDefense
      ? (JSON.parse(battleRaw.activeDefense) as {
          monsterId: string
          action: MonsterDefense
        })
      : undefined,
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

  private getActionFromBattle(
    battle: BattleRedis,
    type: 'attack' | 'defense' | 'pass',
    monsterId: string,
    actionId: number,
  ) {
    if (type === 'pass') return null
    const isChallenger = monsterId === battle.challengerMonsterId

    if (type === 'attack') {
      return isChallenger
        ? battle.challengerAttacks?.find((a) => a.id === actionId)
        : battle.opponentAttacks?.find((a) => a.id === actionId)
    }

    if (type === 'defense') {
      return isChallenger
        ? battle.challengerDefenses?.find((d) => d.id === actionId)
        : battle.opponentDefenses?.find((d) => d.id === actionId)
    }

    return null
  }

  async attack(
    battleId: string,
    actionId: number,
    actionType: 'attack' | 'defense' | 'pass',
    monsterId: string,
  ): Promise<BattleRedis | null> {
    const key = `battle:${battleId}`
    const battleRaw = await this.redisClient.hgetall(key)
    if (!battleRaw || Object.keys(battleRaw).length === 0) return null

    const battle = mapBattleRedisRaw(battleRaw)
    if (battle.currentTurnMonsterId !== monsterId) return null

    const timestamp = new Date().toISOString()
    const isChallenger = monsterId === battle.challengerMonsterId
    const defenderId = isChallenger ? battle.opponentMonsterId : battle.challengerMonsterId

    // 👉 Поиск действия (атаки или защиты)
    const action = this.getActionFromBattle(battle, actionType, monsterId, actionId)
    if (!action) return null //TODO ADD pass

    let damage = 0
    let defenseBlock = 0

    const stamina = isChallenger ? battle.challengerMonsterStamina : battle.opponentMonsterStamina
    const cost = action.energyCost ?? 0

    if (stamina < cost) {
      console.log('⚠️ Недостаточно стамины, авто-пропуск хода:', stamina, '<', cost)
      actionType = 'pass'
      actionId = -1 // несуществующий
    }

    switch (actionType) {
      case 'attack':
        if (battle.activeDefense && battle.activeDefense.monsterId === defenderId) {
          const defenderStats =
            defenderId === battle.challengerMonsterId ? battle.challengerStats : battle.opponentStats

          defenseBlock = Math.round(defenderStats.defense * battle.activeDefense.action.modifier)

          delete battle.activeDefense
        }

        damage = Math.round(
          action.modifier * (isChallenger ? battle.challengerStats.strength : battle.opponentStats.strength),
        )

        const finalDamage = Math.max(0, damage - defenseBlock)

        if (isChallenger) {
          battle.challengerMonsterStamina = Math.max(0, battle.challengerMonsterStamina - (action.energyCost ?? 0) + 5)
        } else {
          battle.opponentMonsterStamina = Math.max(0, battle.opponentMonsterStamina - (action.energyCost ?? 0) + 5)
        }

        if (isChallenger) {
          battle.opponentMonsterHp = Math.max(0, battle.opponentMonsterHp - finalDamage)
        } else {
          battle.challengerMonsterHp = Math.max(0, battle.challengerMonsterHp - finalDamage)
        }
        break

      case 'defense':
        battle.activeDefense = {
          monsterId,
          action: {
            name: action.name,
            modifier: action.modifier,
            cooldown: action.cooldown ?? 0,
            energyCost: action.energyCost ?? 0,
          },
        }
        if (isChallenger) {
          battle.challengerMonsterStamina = Math.max(0, battle.challengerMonsterStamina - (action.energyCost ?? 0) + 10)
        } else {
          battle.opponentMonsterStamina = Math.max(0, battle.opponentMonsterStamina - (action.energyCost ?? 0) + 10)
        }

        break

      case 'pass':
        if (isChallenger) {
          battle.challengerMonsterStamina = battle.challengerMonsterStamina + 20
        } else {
          battle.opponentMonsterStamina = battle.opponentMonsterStamina + 20
        }
        break

      default:
        return null
    }

    // 👉 Проверка победителя
    let winner: string | null = null
    if (battle.challengerMonsterHp === 0) {
      winner = battle.opponentMonsterId
    } else if (battle.opponentMonsterHp === 0) {
      winner = battle.challengerMonsterId
    }

    battle.currentTurnMonsterId = defenderId
    battle.turnStartTime = Date.now()
    battle.turnTimeLimit = 30000

    const logEntry: gameDb.datatypes.BattleLog = {
      from: monsterId,
      to: defenderId,
      action: actionType === 'pass' ? 'attack' : actionType, // TODO add pass
      nameAction: action.name,
      modifier: action.modifier,
      damage: damage,
      block: 0,
      effect: undefined,
      cooldown: action.cooldown ?? 0,
      spCost: action.energyCost ?? 0,
      turnSkip: 0,
      timestamp,
    }

    const logs = battleRaw.logs ? (JSON.parse(battleRaw.logs) as gameDb.datatypes.BattleLog[]) : []
    logs.push(logEntry)
    battle.lastActionLog = `тип деиствия: ${actionType} название: ${action.name} урон: ${damage} защита: ${defenseBlock} энергия: ${action.energyCost}`

    const redisUpdatePayload = {
      challengerMonsterHp: battle.challengerMonsterHp.toString(),
      opponentMonsterHp: battle.opponentMonsterHp.toString(),
      challengerMonsterStamina: battle.challengerMonsterStamina.toString(),
      opponentMonsterStamina: battle.opponentMonsterStamina.toString(),
      currentTurnMonsterId: battle.currentTurnMonsterId,
      turnStartTime: battle.turnStartTime.toString(),
      turnTimeLimit: battle.turnTimeLimit.toString(),
      lastActionLog: battle.lastActionLog,
      activeDefense: battle.activeDefense ? JSON.stringify(battle.activeDefense) : '',
      logs: JSON.stringify(logs),
      ...(winner ? { winnerMonsterId: winner } : {}),
    }

    if (winner) {
      battle.winnerMonsterId = winner

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
        }).catch((error) => logger.error('Fetch result battle', error))
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
