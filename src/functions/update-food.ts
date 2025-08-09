import * as gameDb from 'game-db'
import { EntityManager } from 'typeorm'

export async function updateFood(
  user: gameDb.Entities.User,
  manager: EntityManager,
  foodId: string,
  quantity: number,
): Promise<number> {
  let userInventory = await manager.findOne(gameDb.Entities.UserInventory, {
    where: {
      userId: user.id,
      foodId: foodId,
      userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.FOOD,
    },
  })

  if (!userInventory) {
    userInventory = manager.create(gameDb.Entities.UserInventory, {
      userId: user.id,
      foodId: foodId,
      quantity: quantity,
      userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.FOOD,
    })
  } else {
    userInventory.quantity += quantity
  }

  await manager.save(userInventory)

  return userInventory.quantity
}
