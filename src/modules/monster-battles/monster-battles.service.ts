import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { SortOrderEnum } from '../../datatypes/common/SortOrderEnum'
import { GraphQLResolveInfo } from 'graphql'
import { extractSelectedFieldsAndRelations } from '../../functions/extract-selected-fields-and-relations'
import { MonsterBattles, MonsterBattlesList } from './entities/monster-battles'
import { MonsterBattlesArgs, MonsterBattlesListArgs, MonsterBattlesUpdateArgs } from './dto/monster-battles.args'

@Injectable()
export class MonsterBattlesService {
  constructor() {}

  async findAll(args: MonsterBattlesListArgs, info: GraphQLResolveInfo): Promise<MonsterBattlesList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC, ...filters } = args || {}

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.MonsterBattles)
    const where = buildQueryFilters(filters, gameDb.Entities.MonsterBattles)
    const [items, totalCount] = await gameDb.Entities.MonsterBattles.findAndCount({
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

  async findOne(args: MonsterBattlesArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<MonsterBattles> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.MonsterBattles)
    const monsterBattle = await gameDb.Entities.MonsterBattles.findOne({
      where: { id: args.id },
      relations: relations,
      select: selectedFields,
    })
    if (!monsterBattle) {
      throw new BadRequestException('Monster battles not found')
    }
    return monsterBattle
  }

  async update(args: MonsterBattlesUpdateArgs, info: GraphQLResolveInfo): Promise<MonsterBattles> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Monster)
    const monsterBattles = await gameDb.Entities.MonsterBattles.findOne({
      where: { id: args.id },
      relations: relations,
      select: selectedFields,
    })

    if (!monsterBattles) {
      throw new BadRequestException('Monster Battles not found')
    }

    const { id: _ignored, ...updateData } = args

    Object.assign(monsterBattles, updateData)
    await gameDb.Entities.MonsterBattles.save(monsterBattles)

    return monsterBattles
  }
}
