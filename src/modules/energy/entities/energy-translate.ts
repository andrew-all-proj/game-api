import { ObjectType, Field, ID } from '@nestjs/graphql'
import * as gameDb from 'game-db'

@ObjectType()
export class EnergyTranslate {
  @Field(() => ID, { nullable: false })
  id: number

  @Field(() => ID, { nullable: false })
  energyId: string

  @Field(() => gameDb.datatypes.UserLanguage, { nullable: false })
  language: gameDb.datatypes.UserLanguage

  @Field({ nullable: false })
  name: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: false })
  createdAt: Date

  @Field({ nullable: false })
  updatedAt: Date
}
