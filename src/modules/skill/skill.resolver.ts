import { Resolver, Query, Args, Context, Info } from '@nestjs/graphql'
import { UseGuards } from '@nestjs/common'
import { GqlAuthGuard, RolesGuard, Roles } from '../../functions/auth'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { GraphQLResolveInfo } from 'graphql'
import { Skill, SkillsList } from './entities/skill'
import { SkillService } from './skill.service'
import { SkillArgs, SkillsListArgs } from './dto/skill.args'

@Resolver(() => Skill)
export class SkillResolver {
  constructor(private readonly skillService: SkillService) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Query(() => SkillsList)
  Skills(@Args() args: SkillsListArgs, @Info() info: GraphQLResolveInfo): Promise<SkillsList> {
    return this.skillService.findAll(args, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Query(() => Skill)
  Skill(@Args() args: SkillArgs, @Context() ctx: GraphQLContext, @Info() info: GraphQLResolveInfo): Promise<Skill> {
    return this.skillService.findOne(args, ctx, info)
  }
}
