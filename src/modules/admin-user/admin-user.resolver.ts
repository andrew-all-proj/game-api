import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql'
import { AdminUserService } from './admin-user.service'
import {
  AdminRemoveArgs,
  AdminUserArgs,
  AdminUserCreateArgs,
  AdminUserLoginArgs,
  AdminUsersListArgs,
  AdminUserUpdateArgs,
} from './dto/admin-user.args'
import { AdminUser, AdminUserLogin, AdminUsersList } from './entities/admin-user.entity'
import { UseGuards } from '@nestjs/common'
import { GqlAuthGuard, RolesGuard, Roles } from '../../functions/auth'
import * as gameDb from 'game-db'
import { CommonResponse } from 'src/datatypes/entities/CommonResponse'

@Resolver(() => AdminUser)
export class AdminUserResolver {
  constructor(private readonly userService: AdminUserService) {}

  @Mutation(() => AdminUserLogin)
  AdminUserLogin(@Args() request: AdminUserLoginArgs): Promise<AdminUserLogin> {
    return this.userService.login(request)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.AdminRoleEnum.SUPER_ADMIN)
  @Mutation(() => AdminUser)
  AdminUserCreate(@Args() request: AdminUserCreateArgs): Promise<AdminUser> {
    return this.userService.create(request)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.AdminRoleEnum.SUPER_ADMIN, gameDb.datatypes.AdminRoleEnum.ADMIN)
  @Query(() => AdminUsersList)
  AdminUsersList(@Args() request: AdminUsersListArgs): Promise<AdminUsersList> {
    return this.userService.findAll(request)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.AdminRoleEnum.SUPER_ADMIN, gameDb.datatypes.AdminRoleEnum.ADMIN)
  @Query(() => AdminUser)
  AdminUser(@Args() request: AdminUserArgs) {
    return this.userService.findOne(request)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.AdminRoleEnum.SUPER_ADMIN, gameDb.datatypes.AdminRoleEnum.ADMIN)
  @Mutation(() => AdminUser)
  AdminUserUpdate(@Args() request: AdminUserUpdateArgs): Promise<AdminUser> {
    return this.userService.update(request)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.AdminRoleEnum.SUPER_ADMIN)
  @Mutation(() => CommonResponse)
  AdminUserRemove(@Args() request: AdminRemoveArgs): Promise<CommonResponse> {
    return this.userService.remove(request)
  }
}
