import { Resolver, Query, Args, Context, Info, ResolveField, Parent } from '@nestjs/graphql'
import { UseGuards } from '@nestjs/common'
import { GqlAuthGuard, RolesGuard, Roles } from '../../functions/auth'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { GraphQLResolveInfo } from 'graphql'
import { Food, FoodsList, GetFoodToday } from './entities/food'
import { FoodService } from './food.service'
import { FoodArgs, FoodsListArgs, GetFoodTodayArgs } from './dto/food.args'

@Resolver(() => Food)
export class FoodResolver {
  constructor(private readonly foodService: FoodService) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN, gameDb.datatypes.UserRoleEnum.ADMIN)
  @Query(() => FoodsList)
  Foods(@Args() args: FoodsListArgs, @Info() info: GraphQLResolveInfo): Promise<FoodsList> {
    return this.foodService.findAll(args, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN, gameDb.datatypes.UserRoleEnum.ADMIN)
  @Query(() => Food)
  Food(@Args() args: FoodArgs, @Context() ctx: GraphQLContext, @Info() info: GraphQLResolveInfo): Promise<Food> {
    return this.foodService.findOne(args, ctx, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.USER)
  @Query(() => GetFoodToday)
  GetFoodToday(
    @Args() args: GetFoodTodayArgs,
    @Context() ctx: GraphQLContext,
    @Info() info: GraphQLResolveInfo,
  ): Promise<GetFoodToday> {
    return this.foodService.getFoodToday(args, ctx, info)
  }

  @ResolveField(() => String, { nullable: true })
  name(@Parent() food: Food, @Context() ctx: GraphQLContext): string | null {
    const lang = ctx.language ?? ctx.req.user?.language ?? gameDb.datatypes.UserLanguage.EN

    const translations = food.translations ?? []

    const tr =
      translations.find((t) => t.language === lang) ||
      translations.find((t) => t.language === gameDb.datatypes.UserLanguage.EN)

    return tr?.name ?? food.name ?? null
  }

  @ResolveField(() => String, { nullable: true })
  description(@Parent() food: Food, @Context() ctx: GraphQLContext): string | null {
    const lang = ctx.language ?? ctx.req.user?.language ?? gameDb.datatypes.UserLanguage.EN

    const translations = food.translations ?? []

    const tr =
      translations.find((t) => t.language === lang) ||
      translations.find((t) => t.language === gameDb.datatypes.UserLanguage.EN)

    return tr?.description ?? food.description ?? null
  }
}
