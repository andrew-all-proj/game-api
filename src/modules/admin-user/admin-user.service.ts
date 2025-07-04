import { Injectable } from '@nestjs/common'
import {
  AdminRemoveArgs,
  AdminUserArgs,
  AdminUserCreateArgs,
  AdminUserLoginArgs,
  AdminUsersListArgs,
  AdminUserUpdateArgs,
} from './dto/admin-user.args'
import { AuthService } from './auth.service'
import { AdminUser, AdminUserLogin, AdminUsersList } from './entities/admin-user.entity'
import { BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import * as gameDb from 'game-db'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { extractSelectedFieldsAndRelations } from '../../functions/extract-selected-fields-and-relations'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { GraphQLResolveInfo } from 'graphql'

@Injectable()
export class AdminUserService {
  constructor(private authService: AuthService) {}

  login(query: AdminUserLoginArgs): Promise<AdminUserLogin> {
    return this.authService.login(query)
  }

  async create(query: AdminUserCreateArgs): Promise<AdminUser> {
    const existingUser = await gameDb.Entities.AdminUser.findOne({
      where: { email: query.email },
    })

    if (existingUser) {
      throw new BadRequestException('User with this email already exists')
    }

    const newUser = gameDb.Entities.AdminUser.create({ ...query, password: bcrypt.hashSync(query.password, 10) })
    await newUser.save()

    return newUser
  }

  async findAll(args: AdminUsersListArgs, info: GraphQLResolveInfo): Promise<AdminUsersList> {
    const { offset, limit, sortOrder } = args || {}

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.AdminUser)
    const where = buildQueryFilters(args)
    const [items, totalCount] = await gameDb.Entities.AdminUser.findAndCount({
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

  async findOne(query: AdminUserArgs, info: GraphQLResolveInfo): Promise<AdminUser> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.AdminUser)
    const user = await gameDb.Entities.AdminUser.findOne({
      where: { id: query.id },
      relations: relations,
      select: selectedFields,
    })
    if (!user) {
      throw new BadRequestException('User not found')
    }
    return user
  }

  async update(query: AdminUserUpdateArgs): Promise<AdminUser> {
    const user = await gameDb.Entities.AdminUser.findOne({ where: { id: query.id } })

    if (!user) {
      throw new BadRequestException('User not found')
    }

    //TODO update role only if user is super admin
    //TODO when change email, phone. Confirm change data

    const { id: _ignored, password, role: _, ...updateData } = query

    if (password) {
      user.password = bcrypt.hashSync(password, 10)
    }

    Object.assign(user, updateData)

    await user.save()
    return user
  }

  async remove(query: AdminRemoveArgs): Promise<CommonResponse> {
    const user = await gameDb.Entities.AdminUser.findOne({ where: { id: query.id } })
    if (!user) {
      throw new BadRequestException('User not found')
    }
    await user.softRemove()
    return { success: true }
  }
}
