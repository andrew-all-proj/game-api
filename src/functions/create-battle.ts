import { Redis } from 'ioredis'
import * as gameDb from 'game-db'
import { In } from 'typeorm'
import { getMonsterById } from './redis/get-monster-by-id'
import { BattleRedis } from '../datatypes/common/BattleRedis'
import { logger } from './logger'
import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_TURN_MS, DEFAULT_GRACE_MS, SATIETY_COST } from '../config/battle'

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

  if ((opponentMonster?.satiety ?? 0) < SATIETY_COST || (challengerMonster?.satiety ?? 0) < SATIETY_COST) {
    logger.info('Monster is hungry')
    gameDb.Entities.MonsterBattles.update(
      { id: battleId },
      {
        status: gameDb.datatypes.BattleStatusEnum.REJECTED,
      },
    )
    return false
  }

  if (!opponentMonster?.healthPoints || !challengerMonster?.healthPoints) {
    gameDb.Entities.MonsterBattles.update(
      { id: battleId },
      {
        status: gameDb.datatypes.BattleStatusEnum.REJECTED,
      },
    )
    return false
  }

  const battle: BattleRedis = {
    rejected: false,
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

    challengerAttacks: challengerMonster.monsterAttacks.map((a) => a.skill),
    challengerDefenses: challengerMonster.monsterDefenses.map((d) => d.skill),
    opponentAttacks: opponentMonster.monsterAttacks.map((a) => a.skill),
    opponentDefenses: opponentMonster.monsterDefenses.map((d) => d.skill),

    currentTurnMonsterId: challengerMonsterId,
    turnStartTime: Date.now(),
    turnTimeLimit: DEFAULT_TURN_MS,
    turnNumber: 0,
    turnEndsAtMs: 0,
    graceMs: DEFAULT_GRACE_MS,
    serverNowMs: Date.now(),
    challengerMissedTurns: 0,
    opponentMissedTurns: 0,
    lastActionLog: undefined,
    logs: [],

    challengerSocketId: challengerSocketId ?? '',
    opponentSocketId: opponentSocketId ?? '',

    challengerReady: false,
    opponentReady: false,

    chatId: chatId ?? '',
  }

  await redisClient.set(`battle:${battleId}`, JSON.stringify(battle), 'EX', 180)

  return true
}

const checkEnergyAndSatiety = async (monsterId: string): Promise<boolean> => {
  const monster = await gameDb.Entities.Monster.findOne({ where: { id: monsterId }, relations: ['user'] })
  if (!monster) {
    return false
  }
  if (monster.user.energy >= 125 && monster.satiety >= SATIETY_COST) {
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

  const opponentMonsterUserEnergy = await checkEnergyAndSatiety(opponentMonsterId)
  const challengerMonsterUserEnergy = await checkEnergyAndSatiety(challengerMonsterId)
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
