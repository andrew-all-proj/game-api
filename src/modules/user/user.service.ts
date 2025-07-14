import { BadRequestException, Injectable } from '@nestjs/common'
import { UserArgs, UserCreateArgs, UserLoginArgs, UserRemoveArgs, UsersListArgs, UserUpdateArgs } from './dto/user.args'
import { User, UserLogin, UsersList } from './entities/user'
import * as gameDb from 'game-db'
import { JwtService } from '@nestjs/jwt'
import { parse, isValid } from '@telegram-apps/init-data-node'
import config from '../../config'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { SortOrderEnum } from '../../datatypes/common/SortOrderEnum'
import { GraphQLResolveInfo } from 'graphql'
import { extractSelectedFieldsAndRelations } from '../../functions/extract-selected-fields-and-relations'
import { logger } from '../../functions/logger'
import { calculateAndSaveEnergy } from '../../functions/ calculate-and-save-energy'

@Injectable()
export class UserService {
  constructor(private jwtService: JwtService) {}

  async login(args: UserLoginArgs): Promise<UserLogin> {
    let user: gameDb.Entities.User | null
    try {
      const valid = isValid(args.initData, config.botToken)

      if (!valid && !config.local) {
        throw new BadRequestException('Invalid initData hash')
      }

      let tlgId = args.telegramId
      let tlgUser: any = undefined

      if (!config.local) {
        tlgUser = parse(args.initData).user
        if (tlgUser?.id === undefined) {
          throw new BadRequestException('User not found in initData')
        }
        tlgId = String(tlgUser.id)
      }

      if (!tlgId) {
        throw new BadRequestException('User not found in initData')
      }

      user = await gameDb.Entities.User.findOne({
        where: { telegramId: tlgId.toString() },
        relations: ['avatar'],
      })

      if (!user) {
        user = await gameDb.Entities.User.create({
          name: tlgUser?.first_name || 'Unknown',
          telegramId: tlgId.toString(),
          isRegistered: false,
          nameProfessor: '',
          energy: 1000,
        }).save()

        logger.info(`Created new user: ${user.id}`)
      }
    } catch (err) {
      logger.error(`Login error:`, err)
      throw new BadRequestException('User initData error')
    }

    const payload = {
      sub: user.id,
      role: gameDb.datatypes.UserRoleEnum.USER,
    }

    const token = this.jwtService.sign(payload)

    logger.info(`User login id: ${user.id}`)

    return {
      isRegistered: user.isRegistered,
      token: token,
      id: user.id,
      nameProfessor: user.nameProfessor,
      avatar: user.avatar,
      energy: user.energy,
    }
  }

  async create(args: UserCreateArgs): Promise<User> {
    try {
      const user = await gameDb.Entities.User.create({ ...args }).save()
      logger.info(`Create new user: ${user.id}`)
      return user
    } catch (err) {
      logger.error(`Create user error`, err)
      throw new BadRequestException('Create user error')
    }
  }

  async findAll(args: UsersListArgs, info: GraphQLResolveInfo): Promise<UsersList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC } = args || {}

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.User)
    const where = buildQueryFilters(args)
    const [items, totalCount] = await gameDb.Entities.User.findAndCount({
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

  async findOne(args: UserArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<User> {
    const role = ctx.req.user?.role
    let userId = args.id

    if (role === gameDb.datatypes.UserRoleEnum.USER) {
      userId = ctx.req.user.id
    }

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.User)

    const manager = gameDb.AppDataSource.manager

    const user = await manager.findOne(gameDb.Entities.User, {
      where: { id: userId },
      relations,
      select: [...selectedFields, 'lastEnergyUpdate'],
    })

    if (!user) {
      throw new BadRequestException('User not found')
    }

    const updatedUser = await calculateAndSaveEnergy(user, manager)

    return updatedUser
  }

  async update(args: UserUpdateArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<User> {
    const role = ctx.req.user?.role

    let userIdToUpdate = args.id

    if (role === gameDb.datatypes.UserRoleEnum.USER) {
      userIdToUpdate = ctx.req.user?.id
    }

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.User)
    const user = await gameDb.Entities.User.findOne({
      where: { id: userIdToUpdate },
      relations: relations,
      select: [...selectedFields, 'avatarFileId'],
    })

    if (!user) {
      throw new BadRequestException('User not found')
    }

    const { id: _ignored, ...updateData } = args
    await gameDb.Entities.User.update(userIdToUpdate, updateData)

    return user
  }

  async remove(args: UserRemoveArgs): Promise<CommonResponse> {
    const user = await gameDb.Entities.User.findOne({ where: { id: args.id } })
    if (!user) {
      throw new BadRequestException('User not found')
    }
    await user.softRemove()
    return { success: true }
  }
}
