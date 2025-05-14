import { ObjectType, Field } from '@nestjs/graphql'
import * as gameDb from 'game-db'

@ObjectType('File')
export class File {
  @Field({ nullable: true })
  id?: string

  @Field({ nullable: true })
  name: string

  @Field({ nullable: true })
  description: string

  @Field({ nullable: true })
  url: string

  @Field(() => gameDb.datatypes.FileTypeEnum, { nullable: true })
  fileType?: gameDb.datatypes.FileTypeEnum

  @Field(() => gameDb.datatypes.ContentTypeEnum, { nullable: true })
  contentType?: gameDb.datatypes.ContentTypeEnum

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class FilesList {
  @Field(() => [File], { nullable: true })
  items: File[]

  @Field({ nullable: true })
  totalCount: number
}
