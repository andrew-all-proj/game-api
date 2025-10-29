import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { SortOrderEnum } from '../../datatypes/common/SortOrderEnum'
import { GraphQLResolveInfo } from 'graphql'
import { extractSelectedFieldsAndRelations } from '../../functions/extract-selected-fields-and-relations'
import { SkillArgs, SkillsListArgs } from './dto/skill.args'
import { Skill, SkillsList } from './entities/skill'

@Injectable()
export class SkillService {
  constructor() {}

  async findAll(args: SkillsListArgs, info: GraphQLResolveInfo): Promise<SkillsList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC, ...filters } = args || {}

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Skill)
    const where = buildQueryFilters(filters)
    const [items, totalCount] = await gameDb.Entities.Skill.findAndCount({
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

  async findOne(args: SkillArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<Skill> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Skill)

    const skill = await gameDb.Entities.Skill.findOne({
      where: { id: args.id },
      relations,
      select: [...selectedFields],
    })

    if (!skill) {
      throw new BadRequestException('Skill not found')
    }

    return skill
  }
}
