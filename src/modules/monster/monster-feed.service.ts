import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { logger } from '../../functions/logger'
import { MonsterFeedArgs } from './dto/monster-feed.args'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { resolveUserIdByRole } from 'src/functions/resolve-user-id-by-role'

@Injectable()
export class MonsterFeedService {
  constructor() {}

  async feed(args: MonsterFeedArgs, ctx: GraphQLContext): Promise<CommonResponse> {
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
            type: gameDb.datatypes.UserInventoryTypeEnum.FOOD,
          },
          relations: { food: true },
        })

        if (!userInventory) {
          throw new BadRequestException('Food not found in user inventory')
        }

        if (userInventory.quantity < args.quantity) {
          throw new BadRequestException('Not enough food in inventory')
        }

        const monster = await manager.findOne(gameDb.Entities.Monster, {
          where: { id: args.monsterId, userId: userId },
        })

        if (!monster) {
          throw new BadRequestException('Monster not found')
        }

        const currentSatiety = monster.satiety ?? 0
        const addedSatiety = (userInventory.food.satietyBonus ?? 0) * args.quantity

        if (currentSatiety >= 100) {
          throw new BadRequestException('The monster is already full')
        }

        monster.satiety = Math.min(currentSatiety + addedSatiety, 100)

        await manager.save(monster)

        userInventory.quantity -= args.quantity
        await manager.save(userInventory)
      })

      return { success: true }
    } catch (err: unknown) {
      logger.error('Feed monster error', err)
      let message = 'Feed monster error'
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
