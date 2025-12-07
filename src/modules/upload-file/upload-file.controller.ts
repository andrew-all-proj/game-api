import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
  Body,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import * as multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { Request } from 'express'

import { GqlAuthGuard, Roles, RolesGuard } from '../../functions/auth'
import * as gameDb from 'game-db'
import { UploadFileDto } from './upload-file.dto'
import { S3Service } from './s3.service'
import config from '../../config'

const memoryStorage = multer.memoryStorage()
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])

interface UploadFileResponse {
  id: string
  url: string
  filename: string
  mimetype: string
  size: number
}

interface UploadRequest extends Request {
  generatedFileId?: string
}

@Controller('upload')
export class UploadController {
  constructor(private readonly s3: S3Service) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage,
      limits: { fileSize: Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: UploadRequest,
    @Body() body: UploadFileDto,
  ): Promise<UploadFileResponse> {
    if (!file) throw new BadRequestException('No file provided')
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported mimetype: ${file.mimetype}`)
    }

    const id = uuidv4()
    const key = `${config.s3.prefix}/${id}.png`

    await this.s3.upload({
      key: key,
      buffer: file.buffer,
      contentType: file.mimetype,
    })

    const newFile = gameDb.Entities.File.create({
      id,
      name: body.name,
      fileType: body.fileType,
      contentType: body.contentType ?? file.mimetype,
      url: key,
    })
    await newFile.save()

    return {
      id: newFile.id,
      url: config.fileUrlPrefix + '/' + key,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }
  }
}
