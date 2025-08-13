import { Resolver, Query, Mutation, Args, Context, Info } from '@nestjs/graphql'
import { UserService } from './user.service'
import { User, UserLogin, UsersList } from './entities/user'
import { UserArgs, UserCreateArgs, UserLoginArgs, UserRemoveArgs, UsersListArgs, UserUpdateArgs } from './dto/user.args'
import { UseGuards } from '@nestjs/common'
import { GqlAuthGuard, RolesGuard, Roles } from '../../functions/auth'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { GraphQLResolveInfo } from 'graphql'
import { UserApplyEnergyService } from './user-apply-energy.service'
import { UserApplyEnergyArgs } from './dto/user-apply-energy.args'

@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly userApplyEnergyService: UserApplyEnergyService,
  ) {}

  @Mutation(() => UserLogin)
  UserLogin(@Args() args: UserLoginArgs): Promise<UserLogin> {
    return this.userService.login(args)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN)
  @Mutation(() => User)
  UserCreate(@Args() args: UserCreateArgs): Promise<User> {
    return this.userService.create(args)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN, gameDb.datatypes.UserRoleEnum.ADMIN)
  @Query(() => UsersList)
  Users(@Args() args: UsersListArgs, @Info() info: GraphQLResolveInfo): Promise<UsersList> {
    return this.userService.findAll(args, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Query(() => User)
  User(@Args() args: UserArgs, @Context() ctx: GraphQLContext, @Info() info: GraphQLResolveInfo): Promise<User> {
    return this.userService.findOne(args, ctx, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Mutation(() => User)
  UserUpdate(
    @Args() args: UserUpdateArgs,
    @Context() ctx: GraphQLContext,
    @Info() info: GraphQLResolveInfo,
  ): Promise<User> {
    return this.userService.update(args, ctx, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN, gameDb.datatypes.UserRoleEnum.ADMIN)
  @Mutation(() => CommonResponse)
  UserRemove(@Args() args: UserRemoveArgs): Promise<CommonResponse> {
    return this.userService.remove(args)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.USER)
  @Mutation(() => CommonResponse)
  UserApplyEnergy(@Args() args: UserApplyEnergyArgs, @Context() ctx: GraphQLContext): Promise<CommonResponse> {
    return this.userApplyEnergyService.applyEnergy(args, ctx)
  }
}
