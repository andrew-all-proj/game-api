import { Controller, Post, UploadedFile, UseGuards, UseInterceptors, Req, Body } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { GqlAuthGuard, Roles, RolesGuard } from '../../functions/auth'
import * as gameDb from 'game-db'
import { v4 as uuidv4 } from 'uuid'
import { Request } from 'express'
import { UploadFileDto } from './upload-file.dto'
import config from '../../config'
import * as fs from 'fs'
import * as path from 'path'

interface UploadFileResponse {
  id: string
  url: string
  filename: string
  mimetype: string
  size: number
}

@Controller('upload')
export class UploadController {
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          if (!fs.existsSync(config.fileUploadDir)) {
            fs.mkdirSync(config.fileUploadDir, { recursive: true })
          }

          cb(null, config.fileUploadDir)
        },
        filename: (req: Request, file, cb) => {
          const uniqueId = uuidv4()
          req['generatedFileId'] = uniqueId
          cb(null, `${uniqueId}${extname(file.originalname)}`)
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Body() body: UploadFileDto,
  ): Promise<UploadFileResponse> {
    const id = req['generatedFileId']

    const newFile = gameDb.Entities.File.create({
      id,
      name: body.name,
      fileType: body.fileType,
      contentType: body.contentType,
      url: `${file.filename}`,
    })

    await newFile.save()

    return {
      id: newFile.id,
      url: newFile.url,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    }
  }
}
