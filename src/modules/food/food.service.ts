import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { SortOrderEnum } from '../../datatypes/common/SortOrderEnum'
import { GraphQLResolveInfo } from 'graphql'
import { extractSelectedFieldsAndRelations } from '../../functions/extract-selected-fields-and-relations'
import { FoodArgs, FoodsListArgs, GetFoodTodayArgs } from './dto/food.args'
import { Food, FoodsList, GetFoodToday } from './entities/food'
import { logger } from '../../functions/logger'
import { updateFood } from '../../functions/update-food'
import { EntityManager } from 'typeorm'
import { RulesService } from '../rules/rules.service'

@Injectable()
export class FoodService {
  constructor(private readonly rulesService: RulesService) {}

  async findAll(args: FoodsListArgs, info: GraphQLResolveInfo): Promise<FoodsList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC, ...filters } = args || {}

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Food)
    const where = buildQueryFilters(filters, gameDb.Entities.Food)
    const [items, totalCount] = await gameDb.Entities.Food.findAndCount({
      where: { ...where },
      order: {
        createdAt: sortOrder,
      },
      skip: offset,
      take: limit,
      relations: relations,
      select: [...selectedFields, 'createdAt'],
    })

    return { items, totalCount }
  }

  async findOne(args: FoodArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<Food> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Food)

    const food = await gameDb.Entities.Food.findOne({
      where: { id: args.id },
      relations,
      select: [...selectedFields],
    })

    if (!food) {
      throw new BadRequestException('Food not found')
    }

    return food
  }

  async getFoodToday(args: GetFoodTodayArgs, ctx: GraphQLContext, _info: GraphQLResolveInfo): Promise<GetFoodToday> {
    const role = ctx.req.user?.role
    let userId = args.userId

    if (role === gameDb.datatypes.UserRoleEnum.USER) {
      userId = ctx.req.user?.id
    }

    if (!userId) {
      throw new BadRequestException('User id not provided')
    }

    return await gameDb.AppDataSource.manager.transaction(async (manager: EntityManager): Promise<GetFoodToday> => {
      const user = await manager.findOne(gameDb.Entities.User, {
        where: { id: userId },
        select: ['id', 'lastFoodClaimAt'],
        lock: { mode: 'pessimistic_write' },
      })

      if (!user) {
        throw new BadRequestException('User not found')
      }

      const ruleFoodRequest = (await this.rulesService.getRules()).foodRequest

      if (user.lastFoodClaimAt) {
        const nowMs = Date.now()
        const lastClaimMs = new Date(user.lastFoodClaimAt).getTime()
        const diffMs = nowMs - lastClaimMs

        const periodMs = ruleFoodRequest.periodHours * 60 * 60 * 1000
        if (diffMs < periodMs) {
          return {
            quantity: 0,
            message: 'Вы уже получали еду сегодня',
          }
        }
      }

      const foodRepo = manager.getRepository(gameDb.Entities.Food)
      const foods = await foodRepo.find()

      if (!foods.length) {
        logger.error('No food found in database')
        return {
          quantity: 0,
          message: 'Какая-то ошибка с талонами на еду',
        }
      }

      const food = foods[Math.floor(Math.random() * foods.length)]

      const userInventory = await updateFood(user, manager, food.id, ruleFoodRequest.quantityFood)

      user.lastFoodClaimAt = new Date()
      await manager.update(gameDb.Entities.User, user.id, {
        lastFoodClaimAt: user.lastFoodClaimAt,
      })

      return {
        userInventoryId: userInventory.id,
        quantity: ruleFoodRequest.quantityFood,
        message: `Вы получили ${ruleFoodRequest.quantityFood} ед. еды (${food.name})`,
        food: food,
      }
    })
  }
}
