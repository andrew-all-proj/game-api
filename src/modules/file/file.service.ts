import { BadRequestException, Injectable } from '@nestjs/common'
import { File, FilesList } from './entities/file'
import * as gameDb from 'game-db'
import { FileArgs, FileCreateArgs, FileRemoveArgs, FilesListArgs, FileUpdateArgs } from './dto/file.args'
import { buildQueryFilters } from '../../functions/filters/build-query-filters'
import { SortOrderEnum } from '../../datatypes/common/SortOrderEnum'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'

@Injectable()
export class FileService {
  constructor() {}

  async findAll(args: FilesListArgs): Promise<FilesList> {
    const { offset, limit, sortOrder = SortOrderEnum.DESC } = args || {}

    const where = buildQueryFilters<File>(args)
    const [items, totalCount] = await gameDb.Entities.File.findAndCount({
      where: { ...where },
      order: {
        createdAt: sortOrder,
      },
      skip: offset,
      take: limit,
    })

    return { items, totalCount }
  }

  async findOne(args: FileArgs): Promise<File> {
    const file = await gameDb.Entities.File.findOne({ where: { id: args.id } })
    if (!file) {
      throw new BadRequestException('File not found')
    }
    return file
  }

  async create(args: FileCreateArgs): Promise<File> {
    try {
      return gameDb.Entities.File.create({ ...args }).save()
    } catch (err) {
      console.log('Login error:', err)
      throw new BadRequestException('Create file error')
    }
  }

  async update(args: FileUpdateArgs): Promise<File> {
    const file = await gameDb.Entities.File.findOne({ where: { id: args.id } })

    if (!file) {
      throw new BadRequestException('File not found')
    }

    const { id, ...updateData } = args
    Object.assign(file, updateData)

    await gameDb.Entities.File.save(file)

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
