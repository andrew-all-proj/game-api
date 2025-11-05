import * as gameDb from 'game-db'
import { logger } from './logger'
import { RulesService } from '../modules/rules/rules.service'

export const updateExpMonster = async (
  winnerMonsterId: string,
  loserMonsterId: string,
  winExp: number,
  loseExp: number,
): Promise<void> => {
  try {
    await Promise.all([
      updateSingleMonsterExp(winnerMonsterId, winExp),
      updateSingleMonsterExp(loserMonsterId, loseExp),
    ])
  } catch (error) {
    logger.error('Failed to update experience for monsters:', error)
    throw error
  }
}

const updateSingleMonsterExp = async (monsterId: string, expToAdd: number): Promise<void> => {
  const monster = await gameDb.Entities.Monster.findOne({ where: { id: monsterId } })

  if (!monster) {
    throw new Error(`Monster with ID ${monsterId} not found`)
  }

  const currentLevel = monster.level ?? 1
  const currentExp = monster.experiencePoints ?? 0
  let newExp = currentExp + expToAdd
  let newLevel = currentLevel

  const rules = await new RulesService().getRules()

  let stamina = monster.stamina ?? 0
  let strength = monster.strength ?? 0
  let defense = monster.defense ?? 0
  let evasion = monster.evasion ?? 0

  while (true) {
    const nextLevelData = rules.monsterStartingStats.monsterLevels.find((l) => l.level === newLevel + 1)

    if (!nextLevelData || newExp < nextLevelData.exp) {
      break
    }

    newExp -= nextLevelData.exp
    newLevel += 1

    const mod = nextLevelData.modifier

    stamina = Math.round(stamina * (mod ?? 1))
    strength = Math.round(strength * (mod ?? 1))
    defense = Math.round(defense * (mod ?? 1))
    evasion = Math.round(evasion * (mod ?? 1))
  }

  await gameDb.Entities.Monster.update(monsterId, {
    level: newLevel,
    experiencePoints: newExp,
    stamina,
    strength,
    defense,
    evasion,
  })
}
