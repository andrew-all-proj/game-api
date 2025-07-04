import { Resolver, Query, Mutation, Args, Context, Info } from '@nestjs/graphql'
import { MonsterService } from './monster.service'
import { Monster, MonstersList } from './entities/monster'
import {
  MonsterArgs,
  MonsterCreateArgs,
  MonsterRemoveArgs,
  MonstersListArgs,
  MonsterUpdateArgs,
} from './dto/monster.args'
import { UseGuards } from '@nestjs/common'
import { GqlAuthGuard, RolesGuard, Roles } from '../../functions/auth'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { GraphQLResolveInfo } from 'graphql'

@Resolver(() => Monster)
export class MonsterResolver {
  constructor(private readonly monsterService: MonsterService) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.USER, gameDb.datatypes.UserRoleEnum.SUPER_ADMIN)
  @Mutation(() => Monster)
  MonsterCreate(@Args() args: MonsterCreateArgs, @Context() ctx: GraphQLContext): Promise<Monster> {
    return this.monsterService.create(args, ctx)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.USER,
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
  )
  @Query(() => MonstersList)
  Monsters(@Args() args: MonstersListArgs, @Info() info: GraphQLResolveInfo): Promise<MonstersList> {
    return this.monsterService.findAll(args, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Query(() => Monster)
  Monster(
    @Args() args: MonsterArgs,
    @Context() ctx: GraphQLContext,
    @Info() info: GraphQLResolveInfo,
  ): Promise<Monster> {
    return this.monsterService.findOne(args, ctx, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Mutation(() => Monster)
  MonsterUpdate(
    @Args() args: MonsterUpdateArgs,
    @Context() ctx: GraphQLContext,
    @Info() info: GraphQLResolveInfo,
  ): Promise<Monster> {
    return this.monsterService.update(args, ctx, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.USER,
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
  )
  @Mutation(() => CommonResponse)
  MonsterRemove(@Args() args: MonsterRemoveArgs, @Context() ctx: GraphQLContext): Promise<CommonResponse> {
    return this.monsterService.remove(args, ctx)
  }
}
