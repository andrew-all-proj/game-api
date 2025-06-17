import { Resolver, Query, Mutation, Args, Context, Info } from '@nestjs/graphql'
import { MonsterBattlesService } from './monster-battles.service'
import { MonsterBattles, MonsterBattlesList } from './entities/monster-battles'
import { UseGuards } from '@nestjs/common'
import { GqlAuthGuard, RolesGuard, Roles } from '../../functions/auth'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { GraphQLResolveInfo } from 'graphql'
import {
  MonsterBattlesArgs,
  MonsterBattlesListArgs,
  MonsterBattlesRemoveArgs,
  MonsterBattlesUpdateArgs,
} from './dto/monster-battles.args'

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
  MonsterBattles(
    @Args() args: MonsterBattlesListArgs,
    @Info() info: GraphQLResolveInfo,
    @Context() ctx: GraphQLContext,
  ): Promise<MonsterBattlesList> {
    return this.monsterBattlesService.findAll(args, info, ctx)
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
    return this.monsterBattlesService.update(args, ctx, info)
  }
}
