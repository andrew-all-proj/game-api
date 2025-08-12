import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { EntityManager } from 'typeorm'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { logger } from '../../functions/logger'
import { resolveUserIdByRole } from '../../functions/resolve-user-id-by-role'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { MonsterApplySkillArgs } from './dto/monster-apply-skill.args '

const returnSkillToInventory = async (manager: EntityManager, userId: string, skillId: string): Promise<void> => {
  if (!userId || !skillId) return

  const oldInventory = await manager.findOne(gameDb.Entities.UserInventory, {
    where: {
      userId: userId,
      skillId: skillId,
      userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.SKILL,
    },
  })

  if (oldInventory) {
    oldInventory.quantity += 1
    await manager.save(oldInventory)
  } else {
    const newInv = manager.create(gameDb.Entities.UserInventory, {
      userId,
      skillId,
      quantity: 1,
      userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.SKILL,
    })
    await manager.save(newInv)
  }
}

@Injectable()
export class MonsterApplySkillService {
  constructor() {}

  async applySkill(args: MonsterApplySkillArgs, ctx: GraphQLContext): Promise<CommonResponse> {
    const userId = resolveUserIdByRole(ctx.req.user?.role, ctx, null)
    if (!userId) {
      throw new BadRequestException('User id not found')
    }

    try {
      await gameDb.AppDataSource.transaction(async (manager) => {
        const userInventory = await manager.findOne(gameDb.Entities.UserInventory, {
          where: {
            id: args.userInventoryId,
            userId: userId,
            userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.SKILL,
          },
          relations: { skill: true },
        })

        if (!userInventory) {
          throw new BadRequestException('Skill not found in user inventory')
        }

        if (!userInventory.quantity || userInventory.quantity < 1) {
          throw new BadRequestException('Not enough skill in inventory')
        }

        const monster = await manager.findOne(gameDb.Entities.Monster, {
          where: { id: args.monsterId, userId: userId },
          relations: { monsterAttacks: true, monsterDefenses: true },
        })

        if (!monster) {
          throw new BadRequestException('Monster not found')
        }

        const skill = userInventory.skill

        if (skill.type === gameDb.datatypes.SkillType.ATTACK) {
          if (monster.monsterAttacks.length >= 3 && !args.replacedSkillId) {
            throw new BadRequestException('Monster already has 3 attacks, please replace one')
          }

          if (args.replacedSkillId) {
            const existingAttack = monster.monsterAttacks.find((attack) => attack.skillId === args.replacedSkillId)
            if (!existingAttack) {
              throw new BadRequestException('Replaced skill not found in monster attacks')
            }

            if (existingAttack.skillId === skill.id) {
              return { success: true }
            }

            const result = await manager.update(
              gameDb.Entities.MonsterAttacks,
              { id: existingAttack.id },
              { skillId: skill.id },
            )

            if (result.affected !== 1) {
              throw new BadRequestException('Expected to update 1 row in monster attacks')
            }

            await returnSkillToInventory(manager, userId, args.replacedSkillId)
          } else {
            const newAttack = manager.create(gameDb.Entities.MonsterAttacks, {
              skillId: skill.id,
              monsterId: monster.id,
            })
            await manager.save(newAttack)
          }
        }

        if (skill.type === gameDb.datatypes.SkillType.DEFENSE) {
          if (monster.monsterDefenses.length >= 3 && !args.replacedSkillId) {
            throw new BadRequestException('Monster already has 3 defenses, please replace one')
          }

          if (args.replacedSkillId) {
            const existingDefense = monster.monsterDefenses.find((defense) => defense.skillId === args.replacedSkillId)
            if (!existingDefense) {
              throw new BadRequestException('Replaced skill not found in monster defenses')
            }

            if (existingDefense.skillId === skill.id) {
              return { success: true }
            }

            const result = await manager.update(
              gameDb.Entities.MonsterDefenses,
              { id: existingDefense.id },
              { skillId: skill.id },
            )

            if (result.affected !== 1) {
              throw new BadRequestException('Expected to update 1 row in monster defenses')
            }

            await returnSkillToInventory(manager, userId, args.replacedSkillId)
          } else {
            const newDefense = manager.create(gameDb.Entities.MonsterDefenses, {
              skillId: skill.id,
              monsterId: monster.id,
            })
            await manager.save(newDefense)
          }
        }

        userInventory.quantity -= 1
        if (userInventory.quantity <= 0) {
          await manager.remove(userInventory)
        } else {
          await manager.save(userInventory)
        }
      })

      return { success: true }
    } catch (err: unknown) {
      logger.error('Monster apply skill error', err)
      let message = 'Monster apply skill error'
      if (err instanceof Error) {
        message = err.message
      } else if (typeof err === 'object' && err && 'message' in err) {
        message = String((err as { message: string }).message)
      } else {
        message = String(err)
      }
      throw new BadRequestException(message)
    }
  }
}
