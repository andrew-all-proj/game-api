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

interface CreateBattleToRedisArgs {
  redisClient: Redis
  newBattle: gameDb.Entities.MonsterBattles
  opponentSocketId: string | null
  challengerSocketId: string | null
  chatId?: string
}

export async function createBattleToRedis({
  redisClient,
  newBattle,
  opponentSocketId,
  challengerSocketId,
  chatId,
}: CreateBattleToRedisArgs): Promise<boolean> {
  const { id: battleId, opponentMonsterId, challengerMonsterId } = newBattle

  const battleData: BattleRedis = {
    battleId,
    opponentMonsterId,
    challengerMonsterId,
    challengerMonsterHp: 100,
    opponentMonsterHp: 100,
    currentTurnMonsterId: challengerMonsterId,
    turnStartTime: Date.now(),
    turnTimeLimit: 30000,
    lastActionLog: '',
    challengerSocketId: challengerSocketId ?? '',
    opponentSocketId: opponentSocketId ?? '',
    challengerReady: '0',
    opponentReady: '0',
    chatId: chatId,
  }

  await redisClient.hset(`battle:${battleId}`, {
    ...battleData,
    challengerMonsterHp: battleData.challengerMonsterHp.toString(),
    opponentMonsterHp: battleData.opponentMonsterHp.toString(),
    turnStartTime: battleData.turnStartTime.toString(),
    turnTimeLimit: battleData.turnTimeLimit.toString(),
  })

  await redisClient.expire(`battle:${battleId}`, 3600)

  return true
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

  await createBattleToRedis({
    redisClient,
    newBattle,
    opponentSocketId: opponent?.socketId,
    challengerSocketId: challenger?.socketId,
    chatId: newBattle.chatId,
  })

  return {
    result: true,
    battleId: newBattle.id,
    opponentSocketId: opponent?.socketId,
    challengerSocketId: challenger?.socketId,
  }
}
