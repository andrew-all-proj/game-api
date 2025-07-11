import { Resolver, Query, Mutation, Args, Context, Info, ResolveField, Parent } from '@nestjs/graphql'
import { MonsterBattlesService } from './monster-battles.service'
import { MonsterBattles, MonsterBattlesList } from './entities/monster-battles'
import { UseGuards } from '@nestjs/common'
import { GqlAuthGuard, RolesGuard, Roles } from '../../functions/auth'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { GraphQLResolveInfo } from 'graphql'
import { MonsterBattlesArgs, MonsterBattlesListArgs, MonsterBattlesUpdateArgs } from './dto/monster-battles.args'
import { logger } from '../../functions/logger'

@Resolver(() => MonsterBattles)
export class MonsterBattlesResolver {
  constructor(private readonly monsterBattlesService: MonsterBattlesService) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.USER,
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
  )
  @Query(() => MonsterBattlesList)
  MonsterBattles(@Args() args: MonsterBattlesListArgs, @Info() info: GraphQLResolveInfo): Promise<MonsterBattlesList> {
    return this.monsterBattlesService.findAll(args, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Query(() => MonsterBattles)
  MonsterBattle(
    @Args() args: MonsterBattlesArgs,
    @Context() ctx: GraphQLContext,
    @Info() info: GraphQLResolveInfo,
  ): Promise<MonsterBattles> {
    return this.monsterBattlesService.findOne(args, ctx, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN, gameDb.datatypes.UserRoleEnum.ADMIN)
  @Mutation(() => MonsterBattles)
  MonsterBattleUpdate(
    @Args() args: MonsterBattlesUpdateArgs,
    @Context() ctx: GraphQLContext,
    @Info() info: GraphQLResolveInfo,
  ): Promise<MonsterBattles> {
    return this.monsterBattlesService.update(args, info)
  }

  @ResolveField(() => [gameDb.datatypes.BattleLog], { nullable: true })
  log(@Parent() parent: { log?: string }): gameDb.datatypes.BattleLog[] {
    try {
      return parent.log ? (JSON.parse(parent.log) as gameDb.datatypes.BattleLog[]) : []
    } catch (e) {
      logger.error('Resolver field log', e)
      return []
    }
  }
}
