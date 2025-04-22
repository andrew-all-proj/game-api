import { BadRequestException, Injectable } from '@nestjs/common'
import { UserArgs, UserCreateArgs, UserLoginArgs, UserRemoveArgs, UsersListArgs, UserUpdateArgs } from './dto/user.args'
import { User, UserLogin, UsersList } from './entities/user'
import * as gameDb from 'game-db'
import { JwtService } from '@nestjs/jwt'
import { parse, isValid } from '@telegram-apps/init-data-node'
import config from '../../config'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'

@Injectable()
export class UserService {
  constructor(private jwtService: JwtService) {}

  async login(args: UserLoginArgs): Promise<UserLogin> {
    let user
    try {
      const valid = isValid(args.initData, config.botToken)

      if (!valid && !config.local) {
        throw new BadRequestException('Invalid initData hash')
      }

      let tlgId = args.telegramId

      if (!config.local) {
        const tlgUser = parse(args.initData).user
        if (tlgUser?.id === undefined) {
          throw new BadRequestException('User not found in initData')
        }
        tlgId = String(tlgUser.id)
      }

      if (!tlgId) {
        throw new BadRequestException('User not found in initData')
      }

      user = await gameDb.Entities.User.findOne({ where: { idTelegram: tlgId.toString() } })
    } catch (err) {
      console.log('Login error:', err)
      throw new BadRequestException('User initData error')
    }

    if (!user) {
      throw new BadRequestException('User not found')
    }

    const payload = {
      sub: user.id,
      role: gameDb.datatypes.UserRoleEnum.USER,
    }

    const token = this.jwtService.sign(payload)

    return {
      token: token,
      id: user.id,
      nameProfessor: user.nameProfessor,
    }
  }

  async create(args: UserCreateArgs): Promise<User> {
    try {
      return gameDb.Entities.User.create({ ...args })
    } catch (err) {
      console.log('Login error:', err)
      throw new BadRequestException('Create user error')
    }
  }

  async findAll(args: UsersListArgs): Promise<UsersList> {
    const { offset, limit } = args || {}

    const [items, totalCount] = await gameDb.Entities.User.findAndCount({
      skip: offset,
      take: limit,
    })

    return { items, totalCount }
  }

  async findOne(args: UserArgs, ctx: GraphQLContext): Promise<User> {
    const role = ctx.req.user?.role
    let userId = args.id
    if (role === gameDb.datatypes.UserRoleEnum.USER) {
      userId = ctx.req.user.id
    }
    const user = await gameDb.Entities.User.findOne({ where: { id: userId } })
    if (!user) {
      throw new BadRequestException('User not found')
    }
    return user
  }

  async update(args: UserUpdateArgs, ctx: GraphQLContext): Promise<User> {
    const role = ctx.req.user?.role

    let userIdToUpdate = args.id

    if (role === gameDb.datatypes.UserRoleEnum.USER) {
      userIdToUpdate = ctx.req.user?.id
    }

    const user = await gameDb.Entities.User.findOne({ where: { id: userIdToUpdate } })

    if (!user) {
      throw new BadRequestException('User not found')
    }

    const { id, ...updateData } = args
    Object.assign(user, updateData)

    await gameDb.Entities.User.save(user)

    return user
  }

  async remove(args: UserRemoveArgs): Promise<CommonResponse> {
    const user = await gameDb.Entities.AdminUser.findOne({ where: { id: args.id } })
    if (!user) {
      throw new BadRequestException('User not found')
    }
    await user.softRemove()
    return { success: true }
  }
}
