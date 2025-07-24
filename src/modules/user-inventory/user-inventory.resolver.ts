import { Resolver, Query, Mutation, Args, Context, Info } from '@nestjs/graphql'
import { UseGuards } from '@nestjs/common'
import { GqlAuthGuard, RolesGuard, Roles } from '../../functions/auth'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { GraphQLResolveInfo } from 'graphql'
import { UserInventoriesList, UserInventory } from './entities/user-inventory'
import { UserInventoryService } from './user-inventory.service'
import {
  UserInventoriesListArgs,
  UserInventoryArgs,
  UserInventoryCreateArgs,
  UserInventoryUpdateArgs,
} from './dto/user.args'

@Resolver(() => UserInventory)
export class UserInventoryResolver {
  constructor(private readonly userInventoryService: UserInventoryService) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.USER,
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
  )
  @Query(() => UserInventoriesList)
  UserInventories(
    @Args() args: UserInventoriesListArgs,
    @Info() info: GraphQLResolveInfo,
    @Context() ctx: GraphQLContext,
  ): Promise<UserInventoriesList> {
    return this.userInventoryService.findAll(args, info, ctx)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Query(() => UserInventory)
  UserInventory(
    @Args() args: UserInventoryArgs,
    @Context() ctx: GraphQLContext,
    @Info() info: GraphQLResolveInfo,
  ): Promise<UserInventory> {
    return this.userInventoryService.findOne(args, ctx, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN, gameDb.datatypes.UserRoleEnum.ADMIN)
  @Mutation(() => UserInventory)
  UserInventoryCreate(
    @Args() args: UserInventoryCreateArgs,
    @Context() ctx: GraphQLContext,
    @Info() info: GraphQLResolveInfo,
  ): Promise<UserInventory> {
    return this.userInventoryService.create(args, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN, gameDb.datatypes.UserRoleEnum.ADMIN)
  @Mutation(() => UserInventory)
  UserInventoryUpdate(
    @Args() args: UserInventoryUpdateArgs,
    @Context() ctx: GraphQLContext,
    @Info() info: GraphQLResolveInfo,
  ): Promise<UserInventory> {
    return this.userInventoryService.update(args, info)
  }
}
