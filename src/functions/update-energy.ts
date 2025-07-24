import * as gameDb from 'game-db'
import { EntityManager } from 'typeorm'

export const updateEnergy = async (
  user: gameDb.Entities.User,
  manager: EntityManager,
  delta: number,
): Promise<number> => {
  const currentEnergy = user.energy ?? 0
  const newEnergy = Math.max(0, Math.min(currentEnergy + delta, 1000))

  user.energy = newEnergy
  user.lastEnergyUpdate = new Date()

  await manager.save(user)

  return newEnergy
}
