import { Redis } from 'ioredis'
import * as gameDb from 'game-db'
import { In } from 'typeorm'
import { getMonsterById } from './redis/get-monster-by-id'
import { BattleRedis } from '../datatypes/common/BattleRedis'

interface CreateBattleArgs {
  redisClient: Redis
  opponentMonsterId: string
  challengerMonsterId: string
}

interface CreateBattle {
  result: boolean
  battleId: string | null
  opponentSocketId: string | null
  challengerSocketId: string | null
}

export async function createBattle({
  redisClient,
  opponentMonsterId,
  challengerMonsterId,
}: CreateBattleArgs): Promise<CreateBattle> {
  const opponent = await getMonsterById(redisClient, opponentMonsterId)
  const challenger = await getMonsterById(redisClient, challengerMonsterId)

  if (!opponent?.socketId || !challenger?.socketId)
    return {
      result: false,
      battleId: null,
      opponentSocketId: opponent?.socketId ?? null,
      challengerSocketId: challenger?.socketId ?? null,
    }

  const existingBattle = await gameDb.Entities.MonsterBattles.findOne({
    where: {
      challengerMonsterId,
      opponentMonsterId,
      status: In([gameDb.datatypes.BattleStatusEnum.PENDING, gameDb.datatypes.BattleStatusEnum.ACCEPTED]),
    },
  })

  if (existingBattle) {
    const redisData = await redisClient.hgetall(`battle:${existingBattle.id}`)
    if (redisData && Object.keys(redisData).length > 0) {
      return {
        battleId: existingBattle.id,
        result: true,
        opponentSocketId: opponent?.socketId,
        challengerSocketId: challenger?.socketId,
      }
    } else {
      existingBattle.status = gameDb.datatypes.BattleStatusEnum.REJECTED
      await existingBattle.save()
    }
  }

  const newBattle = gameDb.Entities.MonsterBattles.create({
    challengerMonsterId,
    opponentMonsterId,
    status: gameDb.datatypes.BattleStatusEnum.PENDING,
  })

  await newBattle.save()

  const battleData: BattleRedis = {
    battleId: newBattle.id,
    opponentMonsterId,
    challengerMonsterId,
    challengerMonsterHp: 100,
    opponentMonsterHp: 100,
    currentTurnMonsterId: challengerMonsterId,
    turnStartTime: Date.now(),
    turnTimeLimit: 30000,
    lastActionLog: '',
    challengerSocketId: challenger?.socketId,
    opponentSocketId: opponent?.socketId,
    challengerReady: '0',
    opponentReady: '0',
  }

  await redisClient.hset(`battle:${newBattle.id}`, {
    ...battleData,
    challengerMonsterHp: battleData.challengerMonsterHp.toString(),
    opponentMonsterHp: battleData.opponentMonsterHp.toString(),
    turnStartTime: battleData.turnStartTime.toString(),
    turnTimeLimit: battleData.turnTimeLimit.toString(),
  })

  await redisClient.expire(`battle:${newBattle.id}`, 3600)

  return {
    result: true,
    battleId: newBattle.id,
    opponentSocketId: opponent?.socketId,
    challengerSocketId: challenger?.socketId,
  }
}
