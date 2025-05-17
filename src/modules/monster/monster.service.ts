import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { SortOrderEnum } from '../../datatypes/common/SortOrderEnum'
import { GraphQLResolveInfo } from 'graphql'
import { extractSelectedFieldsAndRelations } from '../../functions/extract-selected-fields-and-relations'
import {
  MonsterArgs,
  MonsterCreateArgs,
  MonsterRemoveArgs,
  MonstersListArgs,
  MonsterUpdateArgs,
} from './dto/monster.args'
import { Monster, MonstersList } from './entities/monster'

@Injectable()
export class MonsterService {
  constructor() {}

  async create(args: MonsterCreateArgs, ctx: GraphQLContext): Promise<Monster> {
    const role = ctx.req.user?.role
    try {
      let userIdCreateMonster = args.userId

      if (role === gameDb.datatypes.UserRoleEnum.USER) {
        userIdCreateMonster = ctx.req.user?.id
      }

      return await gameDb.AppDataSource.transaction(async (manager) => {
        const user = await manager.findOne(gameDb.Entities.User, {
          where: { id: userIdCreateMonster },
          relations: ['monsters'],
        })

        if (!user) {
          throw new BadRequestException('User not found')
        }

        if (user.monsters.length >= 4) {
          throw new BadRequestException('User already has 4 monsters')
        }

        const file = await manager.findOne(gameDb.Entities.File, {
          where: { id: args.fileId },
        })

        if (!file) {
          throw new BadRequestException('File not found')
        }

        const { userId, fileId, ...updateData } = args

        const monster = manager.create(gameDb.Entities.Monster, {
          ...updateData,
          userId: userIdCreateMonster,
          level: 1,
        })

        await manager.save(monster)

        file.monsterId = monster.id
        await manager.save(file)

        return monster
      })
    } catch (err) {
      console.log('Create monster error:', err)
      throw new BadRequestException('Create monster error')
    }
  }

  async findAll(args: MonstersListArgs, info: GraphQLResolveInfo, ctx: GraphQLContext): Promise<MonstersList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC } = args || {}

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Monster)
    const where = buildQueryFilters(args)
    const [items, totalCount] = await gameDb.Entities.Monster.findAndCount({
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

  async findOne(args: MonsterArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<Monster> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Monster)
    const monster = await gameDb.Entities.Monster.findOne({
      where: { id: args.id },
      relations: relations,
      select: selectedFields,
    })
    if (!monster) {
      throw new BadRequestException('User not found')
    }
    return monster
  }

  async update(args: MonsterUpdateArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<Monster> {
    const role = ctx.req.user?.role

    let userIdToUpdateMonster = args.userId

    if (role === gameDb.datatypes.UserRoleEnum.USER) {
      userIdToUpdateMonster = ctx.req.user?.id
    }

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Monster)
    const monster = await gameDb.Entities.Monster.findOne({
      where: { id: args.id, userId: userIdToUpdateMonster },
      relations: relations,
      select: selectedFields,
    })

    if (!monster) {
      throw new BadRequestException('Monster not found')
    }

    const { id, ...updateData } = args
    Object.assign(monster, updateData)

    await gameDb.Entities.Monster.save(monster)

    return monster
  }

  async remove(args: MonsterRemoveArgs, ctx: GraphQLContext): Promise<CommonResponse> {
    const role = ctx.req.user?.role

    let userIdToRemoveMonster = args.userId

    if (role === gameDb.datatypes.UserRoleEnum.USER) {
      userIdToRemoveMonster = ctx.req.user?.id
    }

    const monster = await gameDb.Entities.Monster.findOne({ where: { id: args.id, userId: userIdToRemoveMonster } })
    if (!monster) {
      throw new BadRequestException('Monster not found')
    }
    await monster.softRemove()
    return { success: true }
  }
}
