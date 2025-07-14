import * as gameDb from 'game-db'
import { User } from '../modules/user/entities/user'
import { EntityManager } from 'typeorm'

export async function calculateAndSaveEnergy(user: gameDb.Entities.User, manager: EntityManager): Promise<User> {
  const now = new Date()

  const last = user.lastEnergyUpdate ? new Date(user.lastEnergyUpdate) : new Date(now.getTime() - 5 * 60 * 1000)

  const diffMinutes = Math.floor((now.getTime() - last.getTime()) / 1000 / 60)
  const intervalsPassed = Math.floor(diffMinutes / 5)

  if (intervalsPassed <= 0) {
    return user
  }

  const energyToAdd = intervalsPassed * 25
  const newEnergy = Math.min((user.energy ?? 0) + energyToAdd, 1000)
  const newLastUpdate = new Date(last.getTime() + intervalsPassed * 5 * 60 * 1000)

  await manager.update(
    gameDb.Entities.User,
    { id: user.id },
    {
      energy: newEnergy,
      lastEnergyUpdate: newLastUpdate,
    },
  )

  user.energy = newEnergy
  user.lastEnergyUpdate = newLastUpdate

  return user
}
