import { Resolver, Query, Mutation, Args, Context, Info, ResolveField, Parent } from '@nestjs/graphql'
import { MonsterService } from './monster.service'
import { Monster, MonsterApplyMutagen, MonstersList } from './entities/monster'
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
import { MonsterFeedService } from './monster-feed.service'
import { MonsterFeedArgs } from './dto/monster-feed.args'
import { MonsterApplyMutagenService } from './monster-apply-mutagen.service'
import { MonsterApplyMutagenArgs } from './dto/monster-apply-mutagen.args'
import { MonsterApplySkillService } from './monster-apply-skill.service'
import { MonsterApplySkillArgs } from './dto/monster-apply-skill.args '
import { RulesService } from '../rules/rules.service'

@Resolver(() => Monster)
export class MonsterResolver {
  constructor(
    private readonly monsterService: MonsterService,
    private readonly monsterFeedService: MonsterFeedService,
    private readonly monsterApplyMutagenService: MonsterApplyMutagenService,
    private readonly monsterApplySkillService: MonsterApplySkillService,
    private readonly rulesService: RulesService,
  ) {}

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

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.USER)
  @Mutation(() => CommonResponse)
  MonsterFeed(@Args() args: MonsterFeedArgs, @Context() ctx: GraphQLContext): Promise<CommonResponse> {
    return this.monsterFeedService.feed(args, ctx)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.USER)
  @Mutation(() => MonsterApplyMutagen)
  MonsterApplyMutagen(
    @Args() args: MonsterApplyMutagenArgs,
    @Context() ctx: GraphQLContext,
  ): Promise<MonsterApplyMutagen> {
    return this.monsterApplyMutagenService.applyMutagen(args, ctx)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.USER)
  @Mutation(() => CommonResponse)
  MonsterApplySkill(@Args() args: MonsterApplySkillArgs, @Context() ctx: GraphQLContext): Promise<CommonResponse> {
    return this.monsterApplySkillService.applySkill(args, ctx)
  }

  @ResolveField(() => Number, { nullable: true })
  async nextLevelExp(@Parent() monster: Monster): Promise<number | null> {
    if (!monster || !monster.level) return null

    const rules = await this.rulesService.getRules()
    const nextLevel = monster.level + 1
    const nextLevelData = rules.monsterStartingStats.monsterLevels.find((l) => l.level === nextLevel)

    return nextLevelData?.exp ?? null
  }
}
