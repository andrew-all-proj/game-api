import * as gameDb from 'game-db'

export const updateEnergy = async (userId: string, delta: number): Promise<number | null> => {
  const user = await gameDb.Entities.User.findOne({ where: { id: userId } })

  if (!user) {
    return null
  }

  const currentEnergy = user.energy ?? 0
  const newEnergy = Math.max(0, Math.min(currentEnergy + delta, 1000))

  user.energy = newEnergy
  user.lastEnergyUpdate = new Date()

  await user.save()

  return newEnergy
}
