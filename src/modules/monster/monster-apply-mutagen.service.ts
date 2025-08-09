import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { logger } from '../../functions/logger'
import { resolveUserIdByRole } from '../../functions/resolve-user-id-by-role'
import { MonsterApplyMutagen } from './entities/monster'
import { MonsterApplySkillArgs } from './dto/monster-apply-skill.args '

function getRandomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

@Injectable()
export class MonsterApplyMutagenService {
  constructor() {}

  async applyMutagen(args: MonsterApplySkillArgs, ctx: GraphQLContext): Promise<MonsterApplyMutagen> {
    const userId = resolveUserIdByRole(ctx.req.user?.role, ctx, null)
    if (!userId) {
      throw new BadRequestException('User id not found')
    }

    let result: MonsterApplyMutagen = {}

    try {
      await gameDb.AppDataSource.transaction(async (manager) => {
        const userInventory = await manager.findOne(gameDb.Entities.UserInventory, {
          where: {
            id: args.userInventoryId,
            userId: userId,
            userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.MUTAGEN,
          },
          relations: { mutagen: true },
        })

        if (!userInventory) {
          throw new BadRequestException('Mutagen not found in user inventory')
        }

        if (!userInventory.quantity || userInventory.quantity < 1) {
          throw new BadRequestException('Not enough mutagen in inventory')
        }

        const monster = await manager.findOne(gameDb.Entities.Monster, {
          where: { id: args.monsterId, userId: userId },
        })

        if (!monster) {
          throw new BadRequestException('Monster not found')
        }

        const mutagen = userInventory.mutagen

        result.monsterId = monster.id

        if (mutagen?.strength) {
          const oldStrength = monster.strength
          monster.strength += getRandomInRange(-mutagen.strength, mutagen.strength)
          if (monster.strength < 0) monster.strength = 0
          result.oldStrength = oldStrength
          result.strength = monster.strength
        }

        if (mutagen?.defense) {
          const oldDefense = monster.defense
          monster.defense += getRandomInRange(-mutagen.defense, mutagen.defense)
          if (monster.defense < 0) monster.defense = 0
          result.oldDefense = oldDefense
          result.defense = monster.defense
        }

        if (mutagen?.evasion) {
          const oldEvasion = monster.evasion
          monster.evasion += getRandomInRange(-mutagen.evasion, mutagen.evasion)
          if (monster.evasion < 0) monster.evasion = 0
          result.oldEvasion = oldEvasion
          result.evasion = monster.evasion
        }

        await manager.save(monster)

        userInventory.quantity -= 1
        if (userInventory.quantity <= 0) {
          await manager.remove(userInventory)
        } else {
          await manager.save(userInventory)
        }
      })

      if (!result.monsterId) {
        throw new BadRequestException('Unknown error during transaction')
      }

      return result
    } catch (err: unknown) {
      logger.error('Monster apply mutagen error', err)
      let message = 'Monster apply mutagen error'
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
