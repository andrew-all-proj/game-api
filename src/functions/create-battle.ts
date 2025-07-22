import { Redis } from 'ioredis'
import * as gameDb from 'game-db'
import { In } from 'typeorm'
import { getMonsterById } from './redis/get-monster-by-id'
import { BattleRedis } from '../datatypes/common/BattleRedis'
import { logger } from './logger'
import { v4 as uuidv4 } from 'uuid'

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

const SATIETY_COST = 25

export async function createBattleToRedis({
  redisClient,
  newBattle,
  opponentSocketId,
  challengerSocketId,
  chatId,
}: CreateBattleToRedisArgs): Promise<boolean> {
  const { id: battleId, opponentMonsterId, challengerMonsterId } = newBattle

  const [opponentMonster, challengerMonster] = await Promise.all([
    gameDb.Entities.Monster.findOne({
      where: { id: opponentMonsterId },
      relations: { monsterAttacks: true, monsterDefenses: true, user: true },
    }),
    gameDb.Entities.Monster.findOne({
      where: { id: challengerMonsterId },
      relations: { monsterAttacks: true, monsterDefenses: true, user: true },
    }),
  ])

  const monsters = [opponentMonster, challengerMonster]

  console.log(opponentMonster?.satiety, challengerMonster?.satiety)

  if ((opponentMonster?.satiety ?? 0) < SATIETY_COST || (challengerMonster?.satiety ?? 0) < SATIETY_COST) {
    logger.info('Monster is hungry')
    return false
  }

  for (const monster of monsters) {
    if (!monster) continue
    if ((monster.satiety ?? 0) > SATIETY_COST) {
      monster.satiety = (monster.satiety ?? 0) - SATIETY_COST
      await gameDb.Entities.Monster.update(monster.id, { satiety: monster.satiety })
    }
  }

  if (!opponentMonster?.healthPoints || !challengerMonster?.healthPoints) {
    return false
  }

  const battle: BattleRedis = {
    battleId,
    opponentMonsterId,
    challengerMonsterId,

    opponentUserId: opponentMonster.user.id,
    challengerUserId: challengerMonster.user.id,

    challengerMonsterHp: challengerMonster.healthPoints,
    opponentMonsterHp: opponentMonster.healthPoints,

    challengerMonsterStamina: challengerMonster.stamina,
    opponentMonsterStamina: opponentMonster.stamina,

    challengerStats: {
      healthPoints: challengerMonster.healthPoints,
      stamina: challengerMonster.stamina,
      strength: challengerMonster.strength,
      defense: challengerMonster.defense,
      evasion: challengerMonster.evasion,
    },
    opponentStats: {
      healthPoints: opponentMonster.healthPoints,
      stamina: opponentMonster.stamina,
      strength: opponentMonster.strength,
      defense: opponentMonster.defense,
      evasion: opponentMonster.evasion,
    },

    challengerAttacks: challengerMonster.monsterAttacks ?? [],
    challengerDefenses: challengerMonster.monsterDefenses ?? [],
    opponentAttacks: opponentMonster.monsterAttacks ?? [],
    opponentDefenses: opponentMonster.monsterDefenses ?? [],

    currentTurnMonsterId: challengerMonsterId,
    turnStartTime: Date.now(),
    turnTimeLimit: 30000,
    lastActionLog: undefined,
    logs: [],

    challengerSocketId: challengerSocketId ?? '',
    opponentSocketId: opponentSocketId ?? '',

    challengerReady: '0',
    opponentReady: '0',

    chatId: chatId ?? '',
  }

  await redisClient.set(`battle:${battleId}`, JSON.stringify(battle))
  await redisClient.expire(`battle:${battleId}`, 3600)

  return true
}

const checkEnergy = async (monsterId: string): Promise<boolean> => {
  const monster = await gameDb.Entities.Monster.findOne({ where: { id: monsterId }, relations: ['user'] })
  if (!monster) {
    return false
  }
  if (monster.user.energy >= 125) {
    return true
  }

  return false
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

  const opponentMonsterUserEnergy = await checkEnergy(opponentMonsterId)
  const challengerMonsterUserEnergy = await checkEnergy(challengerMonsterId)
  if (!opponentMonsterUserEnergy || !challengerMonsterUserEnergy) {
    return {
      result: false,
      battleId: null,
      opponentSocketId: opponent?.socketId ?? null,
      challengerSocketId: challenger?.socketId ?? null,
    }
  }

  const newBattle = gameDb.Entities.MonsterBattles.create({
    id: uuidv4(),
    challengerMonsterId,
    opponentMonsterId,
    status: gameDb.datatypes.BattleStatusEnum.PENDING,
  })

  await newBattle.save()

  const battleRedis = await createBattleToRedis({
    redisClient,
    newBattle,
    opponentSocketId: opponent?.socketId,
    challengerSocketId: challenger?.socketId,
    chatId: newBattle.chatId,
  })

  return {
    result: battleRedis,
    battleId: newBattle.id,
    opponentSocketId: opponent?.socketId,
    challengerSocketId: challenger?.socketId,
  }
}
