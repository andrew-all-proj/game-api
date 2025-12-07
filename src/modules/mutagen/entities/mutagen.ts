import { ObjectType, Field } from '@nestjs/graphql'
import { File } from '../../file/entities/file'
import { MutagenTranslate } from './mutagen-translate'

@ObjectType()
export class Mutagen {
  @Field({ nullable: true })
  id: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: true })
  effectDescription?: string

  @Field({ nullable: true })
  strength: number

  @Field({ nullable: true })
  defense: number

  @Field({ nullable: true })
  evasion: number

  @Field({ nullable: true })
  iconFileId: string

  @Field(() => [MutagenTranslate], { nullable: true })
  translations?: MutagenTranslate[]

  @Field(() => File, { nullable: true }) //TODO will make this is array in db
  iconFile?: File

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class MutagensList {
  @Field(() => [Mutagen], { nullable: true })
  items: Mutagen[]

  @Field({ nullable: true })
  totalCount: number
}
