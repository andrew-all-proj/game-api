import * as gameDb from 'game-db'
import { monsterLevels } from '../config/monster-levels'
import { logger } from './logger'

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

  while (true) {
    const nextLevelData = monsterLevels.find((l) => l.level === newLevel + 1)
    if (!nextLevelData || newExp < nextLevelData.exp) {
      break
    }

    newExp -= nextLevelData.exp
    newLevel += 1
  }

  await gameDb.Entities.Monster.update(monsterId, {
    level: newLevel,
    experiencePoints: newExp,
  })
}
