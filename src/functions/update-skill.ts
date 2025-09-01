import * as gameDb from 'game-db'
import { EntityManager } from 'typeorm'

export async function updateSkill(
  user: gameDb.Entities.User,
  manager: EntityManager,
  skillId: string,
  quantity: number,
): Promise<number> {
  let userInventory = await manager.findOne(gameDb.Entities.UserInventory, {
    where: {
      userId: user.id,
      skillId: skillId,
      userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.SKILL,
    },
  })

  if (!userInventory) {
    userInventory = manager.create(gameDb.Entities.UserInventory, {
      userId: user.id,
      skillId: skillId,
      quantity: quantity,
      userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.SKILL,
    })
  } else {
    userInventory.quantity += quantity
  }

  await manager.save(userInventory)

  return userInventory.quantity
}
