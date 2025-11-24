import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { SortOrderEnum } from '../../datatypes/common/SortOrderEnum'
import { GraphQLResolveInfo } from 'graphql'
import { extractSelectedFieldsAndRelations } from '../../functions/extract-selected-fields-and-relations'
import { UserInventoriesList, UserInventory } from './entities/user-inventory'
import {
  UserInventoriesListArgs,
  UserInventoryArgs,
  UserInventoryCreateArgs,
  UserInventoryDeleteArgs,
  UserInventoryUpdateArgs,
} from './dto/user.args'
import { resolveUserIdByRole } from '../../functions/resolve-user-id-by-role'
import { CommonResponse } from 'src/datatypes/entities/CommonResponse'

@Injectable()
export class UserInventoryService {
  constructor() {}

  async findAll(
    args: UserInventoriesListArgs,
    info: GraphQLResolveInfo,
    ctx: GraphQLContext,
  ): Promise<UserInventoriesList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC, ...filters } = args || {}

    const userId = resolveUserIdByRole(ctx.req.user?.role, ctx, args?.userId?.eq)

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.UserInventory)
    const relationsWithSkillTranslations = Array.from(
      new Set([
        ...relations,
        'skill',
        'skill.translations',
        'food',
        'food.translations',
        'mutagen',
        'mutagen.translations',
      ]),
    )

    const where = buildQueryFilters(filters, gameDb.Entities.UserInventory)
    const [items, totalCount] = await gameDb.Entities.UserInventory.findAndCount({
      where: { ...where, userId: userId },
      order: {
        createdAt: sortOrder,
      },
      skip: offset,
      take: limit,
      relations: relationsWithSkillTranslations,
      select: [...selectedFields, 'createdAt', 'id'],
    })

    return { items, totalCount }
  }

  async findOne(args: UserInventoryArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<UserInventory> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.UserInventory)
    const userId = resolveUserIdByRole(ctx.req.user?.role, ctx, null)
    const userInventory = await gameDb.Entities.UserInventory.findOne({
      where: { id: args.id, userId: userId },
      relations: relations,
      select: selectedFields,
    })
    if (!userInventory) {
      throw new BadRequestException('UserInventory not found')
    }
    return userInventory
  }

  async create(args: UserInventoryCreateArgs, info: GraphQLResolveInfo): Promise<UserInventory> {
    const { userId, foodId, mutagenId, quantity } = args

    let userInventoryType: gameDb.datatypes.UserInventoryTypeEnum
    if (foodId && !mutagenId) {
      userInventoryType = gameDb.datatypes.UserInventoryTypeEnum.FOOD
    } else if (mutagenId && !foodId) {
      userInventoryType = gameDb.datatypes.UserInventoryTypeEnum.MUTAGEN
    } else {
      throw new BadRequestException('You must provide either foodId or mutagenId, but not both.')
    }

    const entity = gameDb.Entities.UserInventory.create({
      userId,
      foodId,
      mutagenId,
      quantity,
      userInventoryType,
    })
    await entity.save()

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.UserInventory)
    const freshInventory = await gameDb.Entities.UserInventory.findOne({
      where: { id: entity.id },
      relations,
      select: selectedFields.length > 0 ? selectedFields : undefined,
    })

    return freshInventory!
  }

  async update(args: UserInventoryUpdateArgs, info: GraphQLResolveInfo): Promise<UserInventory> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.UserInventory)
    const userInventory = await gameDb.Entities.UserInventory.findOne({
      where: { id: args.id },
      relations: relations,
      select: selectedFields,
    })

    if (!userInventory) {
      throw new BadRequestException('UserInventory not found')
    }

    const { id: _ignored, ...updateData } = args

    Object.assign(userInventory, updateData)
    await gameDb.Entities.UserInventory.save(userInventory)

    return userInventory
  }

  async delete(args: UserInventoryDeleteArgs, info: GraphQLResolveInfo, ctx: GraphQLContext): Promise<CommonResponse> {
    const userId = resolveUserIdByRole(ctx.req.user?.role, ctx, args?.userId)

    const userInventory = await gameDb.Entities.UserInventory.findOne({
      where: { id: args.id, userId },
    })

    if (!userInventory) {
      throw new BadRequestException('UserInventory not found')
    }

    const qtyToRemove = args.quantity ?? 1

    if (qtyToRemove < 1) {
      throw new BadRequestException('Quantity to remove must be at least 1')
    }

    if (userInventory.quantity > qtyToRemove) {
      userInventory.quantity -= qtyToRemove
      await userInventory.save()
      return { success: true }
    }

    // if quantity >=0, to remove
    await userInventory.remove()
    return { success: true }
  }
}
