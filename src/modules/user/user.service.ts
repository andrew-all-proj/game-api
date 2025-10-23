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
import { resolveUserIdByRole } from '../../functions/resolve-user-id-by-role'
import { createAvatar } from './functions/create-avatar'
import { S3Service } from '../upload-file/s3.service'
import { EntityManager } from 'typeorm'

interface TelegramUser {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
}

@Injectable()
export class UserService {
  constructor(
    private jwtService: JwtService,
    private readonly s3Service: S3Service,
  ) {}

  async login(args: UserLoginArgs): Promise<UserLogin> {
    let user: gameDb.Entities.User | null
    try {
      const valid = isValid(args.initData, config.botToken)

      if (!valid && !config.local) {
        logger.error('Invalid initData hash')
        throw new BadRequestException('Invalid initData hash')
      }

      let tlgId = args.telegramId
      let tlgUser: TelegramUser | undefined = undefined

      if (!config.local) {
        const parsed = parse(args.initData) as { user?: TelegramUser }
        tlgUser = parsed.user
        if (tlgUser?.id === undefined) {
          logger.error('User not found in initData')
          throw new BadRequestException('User not found in initData')
        }
        tlgId = String(tlgUser.id)
      }

      if (!tlgId) {
        logger.error('User not found in initData')
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

        const foods = await gameDb.Entities.Food.find()
        if (!foods.length) {
          logger.error('No food found in database')
        } else {
          const food = foods[Math.floor(Math.random() * foods.length)]
          await gameDb.Entities.UserInventory.create({
            userId: user.id,
            foodId: food.id,
            quantity: 4,
            userInventoryType: gameDb.datatypes.UserInventoryTypeEnum.FOOD,
          }).save()
        }

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
      const user = await gameDb.Entities.User.create({ ...args, energy: 1000 }).save()
      logger.info(`Create new user: ${user.id}`)
      return Object.assign(new User(), user)
    } catch (err) {
      logger.error(`Create user error`, err)
      throw new BadRequestException('Create user error')
    }
  }

  async findAll(args: UsersListArgs, info: GraphQLResolveInfo): Promise<UsersList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC, ...filters } = args || {}

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.User)
    const where = buildQueryFilters(filters)
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
    const userIdToUpdate = resolveUserIdByRole(ctx.req.user?.role, ctx, args.id)
    if (!userIdToUpdate) {
      throw new BadRequestException('User id not found')
    }

    return gameDb.AppDataSource.transaction(async (manager: EntityManager) => {
      let newAvatarFileId: string | undefined

      //CREATE AVATAR FILE IF NEEDED
      if (args.userSelectedParts) {
        const { fileId, url, pngBuffer } = await createAvatar(args.userSelectedParts, manager)
        await this.s3Service.upload({
          key: url,
          buffer: pngBuffer,
          contentType: 'image/png',
        })
        newAvatarFileId = fileId
      }

      const {
        id: _ignoreId,
        userSelectedParts: _ignoreParts,
        avatarFileId: _ignoreAvatarFromArgs,
        ...updateData
      } = args

      if (newAvatarFileId) {
        ;(updateData as any).avatarFileId = newAvatarFileId
      }

      await manager.update(gameDb.Entities.User, { id: userIdToUpdate }, { ...updateData })

      const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.User)

      const user = await manager.findOne(gameDb.Entities.User, {
        where: { id: userIdToUpdate },
        relations,
        select: ['id', 'avatarFileId', ...selectedFields],
      })

      if (!user) {
        throw new BadRequestException('User not found after update')
      }

      return user
    })
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
