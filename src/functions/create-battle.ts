import { Redis } from 'ioredis'
import * as gameDb from 'game-db'
import { BattleRedis } from '../datatypes/common/BattleRedis'
import { logger } from './logger'
import { v4 as uuidv4 } from 'uuid'
import config from '../config'
import { RulesService } from 'src/modules/rules/rules.service'

export interface CreateBattleArgs {
  redisClient: Redis
  opponentMonsterId: string
  challengerMonsterId: string
  chatId?: string
}

interface CreateBattle {
  result: boolean
  battleId: string | null
}

interface CreateBattleToRedisArgs {
  redisClient: Redis
  newBattle: gameDb.Entities.MonsterBattles
  chatId?: string
}

function withFullIconUrl(skill: any): any {
  if (!skill) return skill

  const iconFile = skill.iconFile

  if (!iconFile || !iconFile.url) {
    return {
      ...skill,
    }
  }

  const fullUrl = iconFile.url.startsWith('http') ? iconFile.url : `${config.fileUrlPrefix}${iconFile.url}`

  return {
    ...skill,
    iconFile: {
      ...iconFile,
      url: fullUrl,
    },
  }
}

export async function createBattleToRedis({
  redisClient,
  newBattle,
  chatId,
}: CreateBattleToRedisArgs): Promise<boolean> {
  const { id: battleId, opponentMonsterId, challengerMonsterId } = newBattle

  const rules = await new RulesService().getRules()

  const [opponentMonster, challengerMonster] = await Promise.all([
    gameDb.Entities.Monster.findOne({
      where: { id: opponentMonsterId },
      relations: {
        monsterAttacks: { skill: { iconFile: true } },
        monsterDefenses: { skill: { iconFile: true } },
        user: true,
      },
    }),
    gameDb.Entities.Monster.findOne({
      where: { id: challengerMonsterId },
      relations: {
        monsterAttacks: { skill: { iconFile: true } },
        monsterDefenses: { skill: { iconFile: true } },
        user: true,
      },
    }),
  ])

  if (
    (opponentMonster?.satiety ?? 0) < rules.battle.satietyCostStartBattle ||
    (challengerMonster?.satiety ?? 0) < rules.battle.satietyCostStartBattle
  ) {
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
    logger.error(
      `HP null: ${opponentMonster?.id}: ${opponentMonster?.healthPoints}, ${challengerMonster?.id}: ${challengerMonster?.healthPoints}`,
    )
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

    opponentMonsterLevel: opponentMonster.level,
    challengerMonsterLevel: challengerMonster.level,

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

    challengerAttacks: challengerMonster.monsterAttacks.map((a) => withFullIconUrl(a.skill)),
    challengerDefenses: challengerMonster.monsterDefenses.map((d) => withFullIconUrl(d.skill)),
    opponentAttacks: opponentMonster.monsterAttacks.map((a) => withFullIconUrl(a.skill)),
    opponentDefenses: opponentMonster.monsterDefenses.map((d) => withFullIconUrl(d.skill)),

    currentTurnMonsterId: challengerMonsterId,
    turnStartTime: Date.now(),
    turnTimeLimit: rules.battle.maxTurnsMs,
    turnNumber: 0,
    turnEndsAtMs: 0,
    graceMs: rules.battle.graceMs,
    serverNowMs: Date.now(),
    challengerMissedTurns: 0,
    opponentMissedTurns: 0,
    lastActionLog: undefined,
    logs: [],

    challengerReady: false,
    opponentReady: false,

    chatId: chatId ?? '',
  }

  await redisClient.set(`battle:${battleId}`, JSON.stringify(battle), 'EX', rules.battle.ttlBattleSec)

  return true
}

const checkEnergyAndSatiety = async (monsterId: string, satietyCostStartBattle: number): Promise<boolean> => {
  const monster = await gameDb.Entities.Monster.findOne({ where: { id: monsterId }, relations: ['user'] })
  if (!monster) {
    return false
  }
  if (monster.user.energy >= 125 && monster.satiety >= satietyCostStartBattle) {
    return true
  }

  return false
}

export async function createBattle({
  redisClient,
  opponentMonsterId,
  challengerMonsterId,
  chatId,
}: CreateBattleArgs): Promise<CreateBattle> {
  const rules = await new RulesService().getRules()
  const opponentMonsterUserEnergyAndSatiety = await checkEnergyAndSatiety(
    opponentMonsterId,
    rules.battle.satietyCostStartBattle,
  )
  const challengerMonsterUserEnergyAndSatiety = await checkEnergyAndSatiety(
    challengerMonsterId,
    rules.battle.satietyCostStartBattle,
  )
  if (!opponentMonsterUserEnergyAndSatiety || !challengerMonsterUserEnergyAndSatiety) {
    return {
      result: false,
      battleId: null,
    }
  }

  const newBattle = gameDb.Entities.MonsterBattles.create({
    id: uuidv4(),
    challengerMonsterId,
    opponentMonsterId,
    status: gameDb.datatypes.BattleStatusEnum.PENDING,
    chatId: chatId,
  })

  await newBattle.save()

  const battleRedis = await createBattleToRedis({
    redisClient,
    newBattle,
    chatId: newBattle.chatId,
  })

  if (!battleRedis) {
    logger.info('Battle did not create in Redis')
  }

  return {
    result: battleRedis,
    battleId: newBattle.id,
  }
}
