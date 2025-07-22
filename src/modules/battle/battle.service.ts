import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import { createBattleToRedis } from '../../functions/create-battle'
import * as gameDb from 'game-db'
import { fetchRequest } from '../../functions/fetchRequest'
import config from '../../config'
import { logBattle, logger } from '../../functions/logger'
import { BattleRedis } from '../../datatypes/common/BattleRedis'
import { updateExpMonster } from '../../functions/updateExpMonster'
import { updateEnergy } from '../../functions/update-energy'
import { updateFood } from 'src/functions/ update-food'

@Injectable()
export class BattleService {
  private server: Server

  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

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

    let battle: BattleRedis = JSON.parse(battleStr)

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

    await this.redisClient.set(key, JSON.stringify(battle))

    return battle
  }

  async startBattle(battleId: string, monsterId: string, socketId: string): Promise<BattleRedis | null> {
    const battleRaw = await this.redisClient.get(`battle:${battleId}`)
    if (!battleRaw) return null

    const battle: BattleRedis = JSON.parse(battleRaw)

    if (monsterId === battle.challengerMonsterId) {
      battle.challengerSocketId = socketId
      battle.challengerReady = '1'
    } else if (monsterId === battle.opponentMonsterId) {
      battle.opponentSocketId = socketId
      battle.opponentReady = '1'
    } else {
      return null
    }

    await this.redisClient.set(`battle:${battleId}`, JSON.stringify(battle))

    return battle
  }

  private getActionFromBattle(
    battle: BattleRedis,
    type: gameDb.datatypes.ActionStatusEnum,
    monsterId: string,
    actionId: number,
  ) {
    const isChallenger = monsterId === battle.challengerMonsterId
    if (type === gameDb.datatypes.ActionStatusEnum.PASS) {
      return { name: 'Пропуск', modifier: 0, energyCost: 0, cooldown: 0 }
    }

    if (type === gameDb.datatypes.ActionStatusEnum.ATTACK) {
      return isChallenger
        ? battle.challengerAttacks?.find((a) => a.id === actionId)
        : battle.opponentAttacks?.find((a) => a.id === actionId)
    }

    if (type === gameDb.datatypes.ActionStatusEnum.DEFENSE) {
      return isChallenger
        ? battle.challengerDefenses?.find((d) => d.id === actionId)
        : battle.opponentDefenses?.find((d) => d.id === actionId)
    }

    return null
  }

  async attack(
    battleId: string,
    actionId: number,
    actionType: gameDb.datatypes.ActionStatusEnum,
    monsterId: string,
  ): Promise<BattleRedis | null> {
    const key = `battle:${battleId}`
    let battleStr = await this.redisClient.get(key)
    if (!battleStr) return null

    let battle: BattleRedis = JSON.parse(battleStr)
    if (battle.currentTurnMonsterId !== monsterId) return null

    const timestamp = new Date().toISOString()
    const isChallenger = monsterId === battle.challengerMonsterId
    const defenderId = isChallenger ? battle.opponentMonsterId : battle.challengerMonsterId

    const action = this.getActionFromBattle(battle, actionType, monsterId, actionId)
    if (!action) return null

    let damage = 0
    let defenseBlock = 0

    const stamina = isChallenger ? battle.challengerMonsterStamina : battle.opponentMonsterStamina
    const cost = action.energyCost ?? 0

    if (stamina < cost) {
      actionType = gameDb.datatypes.ActionStatusEnum.PASS
      actionId = -1
    }

    let addStamina = 0

    switch (actionType) {
      case gameDb.datatypes.ActionStatusEnum.ATTACK: {
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
        addStamina = 5

        if (isChallenger) {
          battle.challengerMonsterStamina = Math.max(
            0,
            battle.challengerMonsterStamina - (action.energyCost ?? 0) + addStamina,
          )
        } else {
          battle.opponentMonsterStamina = Math.max(
            0,
            battle.opponentMonsterStamina - (action.energyCost ?? 0) + addStamina,
          )
        }

        if (isChallenger) {
          battle.opponentMonsterHp = Math.max(0, battle.opponentMonsterHp - finalDamage)
        } else {
          battle.challengerMonsterHp = Math.max(0, battle.challengerMonsterHp - finalDamage)
        }
        break
      }
      case gameDb.datatypes.ActionStatusEnum.DEFENSE:
        battle.activeDefense = {
          monsterId,
          action: {
            name: action.name,
            modifier: action.modifier,
            cooldown: action.cooldown ?? 0,
            energyCost: action.energyCost ?? 0,
          },
        }
        addStamina = 10
        if (isChallenger) {
          battle.challengerMonsterStamina = Math.max(
            0,
            battle.challengerMonsterStamina - (action.energyCost ?? 0) + addStamina,
          )
        } else {
          battle.opponentMonsterStamina = Math.max(
            0,
            battle.opponentMonsterStamina - (action.energyCost ?? 0) + addStamina,
          )
        }
        break

      case gameDb.datatypes.ActionStatusEnum.PASS:
        addStamina = 20
        if (isChallenger) {
          battle.challengerMonsterStamina += addStamina
        } else {
          battle.opponentMonsterStamina += addStamina
        }
        break

      default:
        return null
    }

    let winnerMonsterId: string | null = null
    let loserMonsterId: string | null = null
    if (battle.challengerMonsterHp === 0) {
      winnerMonsterId = battle.opponentMonsterId
      loserMonsterId = battle.challengerMonsterId
    } else if (battle.opponentMonsterHp === 0) {
      winnerMonsterId = battle.challengerMonsterId
      loserMonsterId = battle.opponentMonsterId
    }

    battle.currentTurnMonsterId = defenderId
    battle.turnStartTime = Date.now()
    battle.turnTimeLimit = 30000

    const logEntry: gameDb.datatypes.BattleLog = {
      from: monsterId,
      to: defenderId,
      action: actionType,
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

    battle.logs = battle.logs ?? []
    battle.logs.push(logEntry)
    battle.lastActionLog = { monsterId: monsterId, actionName: action.name, damage: damage, stamina: addStamina }

    if (winnerMonsterId && loserMonsterId) {
      battle.winnerMonsterId = winnerMonsterId

      const manager = gameDb.AppDataSource.manager

      await gameDb.Entities.MonsterBattles.update(battleId, {
        status: gameDb.datatypes.BattleStatusEnum.FINISHED,
        winnerMonsterId: winnerMonsterId,
        log: battle.logs,
      })

      updateExpMonster(winnerMonsterId, loserMonsterId).catch((error) => {
        logger.error(`Failed to update experience for winner ${winnerMonsterId} or loser ${loserMonsterId}:`, error)
      })

      logBattle.info('battle', {
        battleId,
        winnerMonsterId: winnerMonsterId,
        challengerMonsterId: battle.challengerMonsterId,
        opponentMonsterId: battle.opponentMonsterId,
        challengerStats: battle.challengerStats,
        opponentStats: battle.opponentStats,
        challengerFinalHp: battle.challengerMonsterHp,
        opponentFinalHp: battle.opponentMonsterHp,
        challengerFinalSp: battle.challengerMonsterStamina,
        opponentFinalSp: battle.opponentMonsterStamina,
        finishedAt: new Date().toISOString(),
        logCount: battle.logs.length,
      })

      battle.logs.forEach((log, index) => {
        logBattle.info('battle-turn', {
          battleId,
          turn: index + 1,
          ...log,
        })
      })

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

          const challengerGetFood = Math.floor(Math.random() * 2) + 1
          const opponentGetFood = Math.floor(Math.random() * 2) + 1

          await Promise.all([
            updateFood(challengerUser, manager, food.id, challengerGetFood),
            updateFood(opponentUser, manager, food.id, opponentGetFood),
          ])

          battle.challengerGetFood = challengerGetFood
          battle.opponentGetFood = opponentGetFood
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

    await this.redisClient.set(key, JSON.stringify(battle))
    await this.redisClient.expire(key, 1800)

    return battle
  }
}
