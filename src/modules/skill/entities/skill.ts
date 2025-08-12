import { ObjectType, Field } from '@nestjs/graphql'
import { File } from '../../file/entities/file'
import * as gameDb from 'game-db'
import GraphQLJSON from 'graphql-type-json'

@ObjectType()
export class Skill {
  @Field({ nullable: true })
  id: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: true })
  strength?: number

  @Field({ nullable: true })
  defense: number

  @Field({ nullable: true })
  evasion: number

  @Field({ nullable: true })
  energyCost: number

  @Field({ nullable: true })
  cooldown: number

  @Field({ nullable: true })
  isBase: boolean

  @Field(() => gameDb.datatypes.SkillRarity, { nullable: true })
  rarity: gameDb.datatypes.SkillRarity

  @Field(() => gameDb.datatypes.SkillType, { nullable: true })
  type: gameDb.datatypes.SkillType

  @Field(() => GraphQLJSON, { nullable: true })
  effects: gameDb.datatypes.SkillBonusEffect

  @Field({ nullable: true })
  iconFileId: string

  @Field(() => File, { nullable: true })
  iconFile?: File

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class SkillsList {
  @Field(() => [Skill], { nullable: true })
  items: Skill[]

  @Field({ nullable: true })
  totalCount: number
}
