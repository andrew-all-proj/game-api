import { ObjectType, Field } from '@nestjs/graphql'
import { File } from '../../file/entities/file'

@ObjectType()
export class Monster {
  @Field({ nullable: true })
  id: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  level?: number

  @Field({ nullable: true })
  isSelected?: boolean

  @Field({ nullable: true })
  userId?: string

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
