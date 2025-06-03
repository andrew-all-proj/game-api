import { Field, ArgsType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsOptional, IsUUID } from 'class-validator'
import { NumberFilter, StringFilter, UuidFilter } from '../../../functions/filters/filters'
import { ContentTypeFilter } from '../../../functions/filters/enum-filters'
import * as gameDb from 'game-db'

@ArgsType()
export class FilesListArgs extends PaginationArgs {
  @IsOptional()
  @Field({ nullable: true })
  id: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  name: StringFilter

  @IsOptional()
  @Field({ nullable: true })
  version: NumberFilter

  @IsOptional()
  @Field({ nullable: true })
  description: StringFilter

  @IsOptional()
  @Field({ nullable: true })
  contentType?: ContentTypeFilter
}

@ArgsType()
export class FileArgs {
  @IsUUID()
  @Field()
  id: string
}

@ArgsType()
export class FileUpdateArgs {
  @IsUUID()
  @Field()
  id: string

  @Field({ nullable: true })
  name: string

  @IsOptional()
  @Field({ nullable: true })
  description: string

  @Field({ nullable: true })
  url: string

  @Field(() => gameDb.datatypes.FileTypeEnum, { nullable: true })
  fileType?: gameDb.datatypes.FileTypeEnum

  @Field(() => gameDb.datatypes.ContentTypeEnum, { nullable: true })
  contentType?: gameDb.datatypes.ContentTypeEnum
}

@ArgsType()
export class FileRemoveArgs {
  @IsUUID()
  @Field()
  id: string
}
