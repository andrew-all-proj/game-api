import { BadRequestException, Injectable } from '@nestjs/common'
import { File, FilesList } from './entities/file'
import * as gameDb from 'game-db'
import { FileArgs, FileRemoveArgs, FilesListArgs, FileUpdateArgs } from './dto/file.args'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { SortOrderEnum } from '../../datatypes/common/SortOrderEnum'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { extractSelectedFieldsAndRelations } from '../../functions/extract-selected-fields-and-relations'
import { GraphQLResolveInfo } from 'graphql'

@Injectable()
export class FileService {
  constructor() {}

  async findAll(args: FilesListArgs, info: GraphQLResolveInfo): Promise<FilesList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC, ...filters } = args || {}

    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.File)
    const where = buildQueryFilters<File>(filters, gameDb.Entities.File)
    const [items, totalCount] = await gameDb.Entities.File.findAndCount({
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

  async findOne(args: FileArgs, info: GraphQLResolveInfo): Promise<File> {
    const { selectedFields, relations } = extractSelectedFieldsAndRelations(info, gameDb.Entities.File)
    const file = await gameDb.Entities.File.findOne({
      where: { id: args.id },
      relations: relations,
      select: selectedFields,
    })
    if (!file) {
      throw new BadRequestException('File not found')
    }
    return file
  }

  async update(args: FileUpdateArgs): Promise<File> {
    const file = await gameDb.Entities.File.findOne({ where: { id: args.id } })

    if (!file) {
      throw new BadRequestException('File not found')
    }

    const { id: _ignored, ...updateData } = args

    await gameDb.Entities.File.save({ ...updateData })

    return file
  }

  async remove(args: FileRemoveArgs): Promise<CommonResponse> {
    const file = await gameDb.Entities.File.findOne({ where: { id: args.id } })
    if (!file) {
      throw new BadRequestException('File not found')
    }
    await file.softRemove()
    return { success: true }
  }
}
