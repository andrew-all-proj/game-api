import { ObjectType, Field } from '@nestjs/graphql'
import { Skill } from '../../skill/entities/skill'

@ObjectType()
export class MonsterDefenses {
  @Field({ nullable: true })
  id: number

  @Field({ nullable: true })
  monsterId: string

  @Field({ nullable: true })
  skillId: string

  @Field(() => Skill, { nullable: true })
  skill: Skill

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}
