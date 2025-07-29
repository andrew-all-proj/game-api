import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { logger } from '../../functions/logger'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { resolveUserIdByRole } from '../../functions/resolve-user-id-by-role'
import { MonsterApplyMutagenArgs } from './dto/monster-apply-mutagen.args'

@Injectable()
export class MonsterApplyMutagenService {
  constructor() {}

  async apply(args: MonsterApplyMutagenArgs, ctx: GraphQLContext): Promise<CommonResponse> {
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
            type: gameDb.datatypes.UserInventoryTypeEnum.MUTAGEN,
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

        if (mutagen?.strength) {
          monster.strength += mutagen.strength
        }

        if (mutagen?.defense) {
          monster.defense += mutagen.defense
        }

        if (mutagen?.evasion) {
          monster.evasion += mutagen.evasion
        }

        await manager.save(monster)

        userInventory.quantity -= 1
        if (userInventory.quantity <= 0) {
          await manager.remove(userInventory)
        } else {
          await manager.save(userInventory)
        }

        await manager.save(userInventory)
      })

      return { success: true }
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
