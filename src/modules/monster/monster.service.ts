import { BadRequestException, Injectable } from '@nestjs/common'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { SortOrderEnum } from '../../datatypes/common/SortOrderEnum'
import { GraphQLResolveInfo } from 'graphql'
import { extractSelectedFieldsAndRelations } from '../../functions/extract-selected-fields-and-relations'
import {
  MonsterArgs,
  MonsterCreateArgs,
  MonsterRemoveArgs,
  MonstersListArgs,
  MonsterUpdateArgs,
} from './dto/monster.args'
import { Monster, MonstersList } from './entities/monster'
import { createSpriteSheetMonster } from './functions/createSpriteSheet'
import { logger } from '../../functions/logger'
import { createAvatarMonster } from './functions/createAvatarMonster'
import { S3Service } from '../upload-file/s3.service'
import { extractPartId } from './functions/extractPartId'
import { RulesService } from '../rules/rules.service'

@Injectable()
export class MonsterService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly rulesService: RulesService,
  ) {}

  async create(args: MonsterCreateArgs, ctx: GraphQLContext): Promise<Monster> {
    const role = ctx.req.user?.role
    const rules = await this.rulesService.getRules()
    try {
      let userIdCreateMonster = args.userId

      if (role === gameDb.datatypes.UserRoleEnum.USER) {
        userIdCreateMonster = ctx.req.user?.id
      }

      if (!userIdCreateMonster) {
        throw new BadRequestException('userId is missing before monster creation')
      }

      const newMonster = await gameDb.AppDataSource.transaction(async (manager) => {
        const user = await manager.findOne(gameDb.Entities.User, {
          where: { id: userIdCreateMonster },
          lock: { mode: 'pessimistic_write' },
        })
        if (!user) throw new BadRequestException('User not found')

        const monstersCount = await manager.count(gameDb.Entities.Monster, { where: { userId: user.id } })
        if (monstersCount >= 4) throw new BadRequestException('User already has 4 monsters')
        if (user.energy < rules.monsterStartingStats.costToCreateMonster)
          throw new BadRequestException('Not enough energy to create a monster')

        user.energy -= rules.monsterStartingStats.costToCreateMonster
        await manager.save(user)

        const selectedPartsAny = args.selectedPartsKey
        const monsterParts: gameDb.datatypes.MonsterParts = {
          head: { id: extractPartId(selectedPartsAny.headKey) },
          body: { id: extractPartId(selectedPartsAny.bodyKey) },
          arms: {
            id: extractPartId(selectedPartsAny.leftArmKey),
          },
        }
        const monster = manager.create(gameDb.Entities.Monster, {
          name: args.name,
          userId: user.id,
          monsterParts,
          ...rules.monsterStartingStats.monster,
        })
        await manager.save(monster)

        const baseSkills = await manager.getRepository(gameDb.Entities.Skill).find({ where: { isBase: true } })

        const attacks = baseSkills
          .filter((s) => s.type === gameDb.datatypes.SkillType.ATTACK)
          .map((s) => manager.create(gameDb.Entities.MonsterAttacks, { skillId: s.id, monsterId: monster.id }))
        await manager.save(attacks)

        const defenses = baseSkills
          .filter((s) => s.type === gameDb.datatypes.SkillType.DEFENSE)
          .map((s) => manager.create(gameDb.Entities.MonsterDefenses, { skillId: s.id, monsterId: monster.id }))
        await manager.save(defenses)

        const createdAvatrMonster = await createAvatarMonster(args.selectedPartsKey, monster.id, manager)
        const createdSpriteSheetMonster = await createSpriteSheetMonster(args.selectedPartsKey, monster.id, manager)

        await this.s3Service.upload({
          key: createdAvatrMonster.url,
          buffer: createdAvatrMonster.pngBuffer,
          contentType: 'image/png',
        })

        await this.s3Service.upload({
          key: createdSpriteSheetMonster.imageUrl,
          buffer: createdSpriteSheetMonster.pngBuffer,
          contentType: 'image/png',
        })

        await this.s3Service.upload({
          key: createdSpriteSheetMonster.atlasUrl,
          buffer: createdSpriteSheetMonster.atlasJsonBuffer,
          contentType: 'image/png',
        })

        return monster
      })
      return newMonster
    } catch (err: unknown) {
      logger.error('Create monster error', err)
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: string }).message)
            : String(err)
      throw new BadRequestException(message)
    }
  }

  async findAll(args: MonstersListArgs, info: GraphQLResolveInfo): Promise<MonstersList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC, ...filters } = args || {}
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Monster)
    const where = buildQueryFilters(filters, gameDb.Entities.Monster)
    const [items, totalCount] = await gameDb.Entities.Monster.findAndCount({
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

  async findOne(args: MonsterArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<Monster> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Monster)
    const monster = await gameDb.Entities.Monster.findOne({
      where: { id: args.id },
      relations: relations,
      select: selectedFields,
    })
    if (!monster) {
      throw new BadRequestException('Monster not found')
    }
    return monster
  }

  async update(args: MonsterUpdateArgs, ctx: GraphQLContext, info: GraphQLResolveInfo): Promise<Monster> {
    const role = ctx.req.user?.role

    let userIdToUpdateMonster = args.userId

    if (role === gameDb.datatypes.UserRoleEnum.USER) {
      userIdToUpdateMonster = ctx.req.user?.id
    }

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.Monster)
    const monster = await gameDb.Entities.Monster.findOne({
      where: { id: args.id, userId: userIdToUpdateMonster },
      relations: relations,
      select: selectedFields,
    })

    if (!monster) {
      throw new BadRequestException('Monster not found')
    }

    const { id: _ignored, ...updateData } = args

    if (args.isSelected) {
      const selectedMonsters = await gameDb.Entities.Monster.find({
        where: { userId: userIdToUpdateMonster, isSelected: true },
      })

      for (const selectedMonster of selectedMonsters) {
        if (selectedMonster.id !== monster.id) {
          selectedMonster.isSelected = false
          await gameDb.Entities.Monster.save(selectedMonster)
        }
      }
    }

    Object.assign(monster, updateData)
    await gameDb.Entities.Monster.save(monster)

    return monster
  }

  async remove(args: MonsterRemoveArgs, ctx: GraphQLContext): Promise<CommonResponse> {
    const role = ctx.req.user?.role

    let userIdToRemoveMonster = args.userId

    if (role === gameDb.datatypes.UserRoleEnum.USER) {
      userIdToRemoveMonster = ctx.req.user?.id
    }

    const monster = await gameDb.Entities.Monster.findOne({ where: { id: args.id, userId: userIdToRemoveMonster } })
    if (!monster) {
      throw new BadRequestException('Monster not found')
    }
    await monster.softRemove()
    return { success: true }
  }
}
