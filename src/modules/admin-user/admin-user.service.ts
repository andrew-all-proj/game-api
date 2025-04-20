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
import * as dbGame from 'game-db'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'

@Injectable()
export class AdminUserService {
  constructor(private authService: AuthService) {}

  login(query: AdminUserLoginArgs): Promise<AdminUserLogin> {
    return this.authService.login(query)
  }

  async create(query: AdminUserCreateArgs): Promise<AdminUser> {
    const existingUser = await dbGame.Entities.AdminUser.findOne({
      where: { email: query.email },
    })

    if (existingUser) {
      throw new BadRequestException('User with this email already exists')
    }

    const newUser = dbGame.Entities.AdminUser.create({ ...query, password: bcrypt.hashSync(query.password, 10) })
    await newUser.save()

    return newUser
  }

  async findAll(query: AdminUsersListArgs): Promise<AdminUsersList> {
    const { offset, limit } = query || {}

    const [items, totalCount] = await dbGame.Entities.AdminUser.findAndCount({
      skip: offset,
      take: limit,
    })

    return { items, totalCount }
  }

  async findOne(query: AdminUserArgs): Promise<AdminUser> {
    const user = await dbGame.Entities.AdminUser.findOne({ where: { id: query.id } })
    if (!user) {
      throw new BadRequestException('User not found')
    }
    return user
  }

  async update(query: AdminUserUpdateArgs): Promise<AdminUser> {
    const user = await dbGame.Entities.AdminUser.findOne({ where: { id: query.id } })

    if (!user) {
      throw new BadRequestException('User not found')
    }

    //TODO update role only if user is super admin
    //TODO when change email, phone. Confirm change data

    const { id, password, role, ...updateData } = query

    if (password) {
      ;(updateData as any).password = bcrypt.hashSync(password, 10)
    }

    Object.assign(user, updateData)

    await user.save()
    return user
  }

  async remove(query: AdminRemoveArgs): Promise<CommonResponse> {
    const user = await dbGame.Entities.AdminUser.findOne({ where: { id: query.id } })
    if (!user) {
      throw new BadRequestException('User not found')
    }
    await user.softRemove()
    return { success: true }
  }
}
