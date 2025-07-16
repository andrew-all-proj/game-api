import { ObjectType, Field } from '@nestjs/graphql'
import { File } from '../../file/entities/file'
import { MonsterAttacks } from '../../monster-attacks/entities/monster-attacks'
import { MonsterDefenses } from '../../monster-defenses/entities/monster-defenses'

@ObjectType()
export class Monster {
  @Field({ nullable: true })
  id: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  level?: number

  @Field({ nullable: true })
  nextLevelExp?: number

  @Field({ nullable: true })
  isSelected?: boolean

  @Field({ nullable: true })
  healthPoints?: number

  @Field({ nullable: true })
  stamina: number

  @Field({ nullable: true })
  strength: number

  @Field({ nullable: true })
  defense: number

  @Field({ nullable: true })
  evasion: number

  @Field({ nullable: true })
  satiety: number

  @Field({ nullable: true })
  lastFedAt: Date

  @Field({ nullable: true })
  experiencePoints: number

  @Field({ nullable: true })
  userId?: string

  @Field(() => [MonsterAttacks], { nullable: true })
  monsterAttacks?: MonsterAttacks[]

  @Field(() => [MonsterDefenses], { nullable: true })
  monsterDefenses?: MonsterDefenses[]

  @Field(() => [File], { nullable: true })
  files?: File[]

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class MonstersList {
  @Field(() => [Monster], { nullable: true })
  items: Monster[]

  @Field({ nullable: true })
  totalCount: number
}
