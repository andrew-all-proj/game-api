import * as gameDb from 'game-db'
import { EntityManager } from 'typeorm'

export async function updateMutagen(
  user: gameDb.Entities.User,
  manager: EntityManager,
  mutagenId: string,
  quantity: number,
): Promise<number> {
  let userInventory = await manager.findOne(gameDb.Entities.UserInventory, {
    where: {
      userId: user.id,
      mutagenId: mutagenId,
      userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.MUTAGEN,
    },
  })

  if (!userInventory) {
    userInventory = manager.create(gameDb.Entities.UserInventory, {
      userId: user.id,
      mutagenId: mutagenId,
      quantity: quantity,
      userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.MUTAGEN,
    })
  } else {
    userInventory.quantity += quantity
  }

  await manager.save(userInventory)
  return userInventory.quantity
}
