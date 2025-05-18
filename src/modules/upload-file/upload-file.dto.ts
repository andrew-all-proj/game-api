import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import * as gameDb from 'game-db'

export class UploadFileDto {
  @IsString()
  @IsOptional()
  name: string

  @IsEnum(gameDb.datatypes.FileTypeEnum)
  @IsNotEmpty()
  fileType: gameDb.datatypes.FileTypeEnum

  @IsEnum(gameDb.datatypes.ContentTypeEnum)
  @IsNotEmpty()
  contentType: gameDb.datatypes.ContentTypeEnum
}
