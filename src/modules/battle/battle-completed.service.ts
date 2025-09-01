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
import { REWARD_CONFIG, SATIETY_COST } from '../../config/battle'
import { EntityManager } from 'typeorm'
import { updateSkill } from '../../functions/update-skill'
import { updateMutagen } from '../../functions/update-mutagen'

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const roll = (p: number) => Math.random() < p

@Injectable()
export class BattleCompletedService {
  private server: Server
  constructor(@Inject('REDIS_CLIENT') readonly redisClient: Redis) {}
  setServer(server: Server) {
    this.server = server
  }

  async rewardsFood(
    manager: EntityManager,
    battle: BattleRedis,
    challengerUser: gameDb.Entities.User,
    opponentUser: gameDb.Entities.User,
    winnerMonsterId: string,
  ) {
    if (!roll(REWARD_CONFIG.food.chance)) return

    const foodRepo = gameDb.AppDataSource.getRepository(gameDb.Entities.Food)
    const foods = await foodRepo.find()
    if (!foods.length) {
      logger.error('No food found in database')
      return
    }

    const food = foods[Math.floor(Math.random() * foods.length)]
    const qty = randInt(REWARD_CONFIG.food.min, REWARD_CONFIG.food.max)

    const winnerIsChallenger = winnerMonsterId === battle.challengerMonsterId
    const winnerUser = winnerIsChallenger ? challengerUser : opponentUser

    await updateFood(winnerUser, manager, food.id, qty)

    if (winnerIsChallenger) {
      battle.challengerGetReward = {
        ...(battle.challengerGetReward ?? {}),
        food: { id: food.id, name: food.name, quantity: qty },
      }
    } else {
      battle.opponentGetReward = {
        ...(battle.opponentGetReward ?? {}),
        food: { id: food.id, name: food.name, quantity: qty },
      }
    }
  }

  async rewardsMutagens(
    manager: EntityManager,
    battle: BattleRedis,
    challengerUser: gameDb.Entities.User,
    opponentUser: gameDb.Entities.User,
    winnerMonsterId: string,
  ) {
    if (!roll(REWARD_CONFIG.mutagen.chance)) return

    const candidates = await gameDb.Entities.Mutagen.find()
    if (!candidates.length) {
      logger.error('No mutagens found in database')
      return
    }

    const mutagen = candidates[Math.floor(Math.random() * candidates.length)]
    const qty =
      REWARD_CONFIG.mutagen.min != null && REWARD_CONFIG.mutagen.max != null
        ? randInt(REWARD_CONFIG.mutagen.min, REWARD_CONFIG.mutagen.max)
        : 1

    const winnerIsChallenger = winnerMonsterId === battle.challengerMonsterId
    const winnerUser = winnerIsChallenger ? challengerUser : opponentUser

    await updateMutagen(winnerUser, manager, mutagen.id, qty)

    if (winnerIsChallenger) {
      battle.challengerGetReward = {
        ...(battle.challengerGetReward ?? {}),
        mutagen: { id: mutagen.id, name: mutagen.name, quantity: qty } as any,
      }
    } else {
      battle.opponentGetReward = {
        ...(battle.opponentGetReward ?? {}),
        mutagen: { id: mutagen.id, name: mutagen.name, quantity: qty } as any,
      }
    }
  }

  async rewardsSkill(
    manager: EntityManager,
    battle: BattleRedis,
    challengerUser: gameDb.Entities.User,
    opponentUser: gameDb.Entities.User,
    winnerMonsterId: string,
  ) {
    if (!roll(REWARD_CONFIG.skill.chance)) return

    const candidates = await gameDb.Entities.Skill.find({
      where: { rarity: gameDb.datatypes.SkillRarity.COMMON, isBase: false },
    })
    if (!candidates.length) {
      logger.error('No skill found in database')
      return
    }

    const skill = candidates[Math.floor(Math.random() * candidates.length)]

    const qty =
      REWARD_CONFIG.skill.min != null && REWARD_CONFIG.skill.max != null
        ? randInt(REWARD_CONFIG.skill.min, REWARD_CONFIG.skill.max)
        : 1

    const winnerIsChallenger = winnerMonsterId === battle.challengerMonsterId
    const winnerUser = winnerIsChallenger ? challengerUser : opponentUser

    await updateSkill(winnerUser, manager, skill.id, qty)

    if (winnerIsChallenger) {
      battle.challengerGetReward = {
        ...(battle.challengerGetReward ?? {}),
        skill: { id: skill.id, name: skill.name, quantity: qty } as any,
      }
    } else {
      battle.opponentGetReward = {
        ...(battle.opponentGetReward ?? {}),
        skill: { id: skill.id, name: skill.name, quantity: qty } as any,
      }
    }
  }

  /**
   * Completes the battle, updates the database, awards rewards, etc.
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

    const challengerUser = await manager.findOne(gameDb.Entities.User, { where: { id: battle.challengerUserId } })
    const opponentUser = await manager.findOne(gameDb.Entities.User, { where: { id: battle.opponentUserId } })

    if (!challengerUser || !opponentUser) {
      if (!challengerUser) logger.error('Challenger user not found')
      if (!opponentUser) logger.error('Opponent user not found')
      return
    }

    await this.rewardsFood(manager, battle, challengerUser, opponentUser, winnerMonsterId)
    await this.rewardsSkill(manager, battle, challengerUser, opponentUser, winnerMonsterId)
    await this.rewardsMutagens(manager, battle, challengerUser, opponentUser, winnerMonsterId)

    const winnerIsCh = winnerMonsterId === battle.challengerMonsterId
    if (winnerIsCh) {
      battle.challengerGetReward = {
        ...(battle.challengerGetReward ?? {}),
        exp: battleExpRewards.winExp,
      }
      battle.opponentGetReward = {
        ...(battle.opponentGetReward ?? {}),
        exp: battleExpRewards.loseExp,
      }
    } else {
      battle.opponentGetReward = {
        ...(battle.opponentGetReward ?? {}),
        exp: battleExpRewards.winExp,
      }
      battle.challengerGetReward = {
        ...(battle.challengerGetReward ?? {}),
        exp: battleExpRewards.loseExp,
      }
    }

    await Promise.all([updateEnergy(challengerUser, manager, -125), updateEnergy(opponentUser, manager, -125)])

    if (battle.chatId) {
      fetchRequest({
        url: `http://${config.botServiceUrl}/result-battle/${battleId}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${config.botServiceToken}` },
      }).catch((error) => logger.error('Fetch result battle', error))
    }
  }
}
