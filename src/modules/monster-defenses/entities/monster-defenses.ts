import { ObjectType, Field } from '@nestjs/graphql'

@ObjectType()
export class MonsterDefenses {
  @Field({ nullable: true })
  id: number

  @Field({ nullable: true })
  monsterId: string

  @Field({ nullable: true })
  name: string

  @Field({ nullable: true })
  modifier: number

  @Field({ nullable: true })
  energyCost: number

  @Field({ nullable: true })
  cooldown: number

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}
