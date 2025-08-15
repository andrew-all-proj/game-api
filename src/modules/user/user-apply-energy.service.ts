import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { logger } from '../../functions/logger'
import { resolveUserIdByRole } from '../../functions/resolve-user-id-by-role'
import { UserApplyEnergyArgs } from './dto/user-apply-energy.args'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'

@Injectable()
export class UserApplyEnergyService {
  private static readonly MAX_ENERGY = 1000

  async applyEnergy(args: UserApplyEnergyArgs, ctx: GraphQLContext): Promise<CommonResponse> {
    const userId = resolveUserIdByRole(ctx.req.user?.role, ctx, args?.userId)
    if (!userId) throw new BadRequestException('User id not found')

    try {
      await gameDb.AppDataSource.transaction(async (manager) => {
        const userInventory = await manager.findOne(gameDb.Entities.UserInventory, {
          where: {
            id: args.userInventoryId,
            userId,
            userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.ENERGY,
          },
          relations: { energy: true },
        })
        if (!userInventory) throw new BadRequestException('Energy not found in user inventory')
        if (!userInventory.quantity || userInventory.quantity < 1) {
          throw new BadRequestException('Not enough energy items in inventory')
        }

        const user = await manager.findOne(gameDb.Entities.User, { where: { id: userId } })
        if (!user) throw new BadRequestException('User not found')

        const energyItem = userInventory.energy
        const current = user.energy ?? 0
        const max = UserApplyEnergyService.MAX_ENERGY

        if (current >= max) {
          throw new BadRequestException('Energy is already at maximum')
        }

        const gain = Math.min(energyItem.quantity, max - current)
        user.energy = current + gain
        await manager.save(user)

        userInventory.quantity -= 1
        if (userInventory.quantity <= 0) {
          await manager.remove(userInventory)
        } else {
          await manager.save(userInventory)
        }
      })

      return { success: true }
    } catch (err: unknown) {
      logger.error('Apply energy error', err)
      let message = 'Apply energy error'
      if (err instanceof Error) message = err.message
      else if (typeof err === 'object' && err && 'message' in err)
        message = String((err as { message: string }).message)
      else message = String(err)
      throw new BadRequestException(message)
    }
  }
}
