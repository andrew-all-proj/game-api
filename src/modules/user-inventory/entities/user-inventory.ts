import { ObjectType, Field } from '@nestjs/graphql'
import { User } from '../../user/entities/user'
import { Mutagen } from '../../mutagen/entities/mutagen'
import * as gameDb from 'game-db'
import { Food } from '../../food/entities/food'

@ObjectType()
export class UserInventory {
  @Field({ nullable: true })
  id: string

  @Field({ nullable: true })
  userId: string

  @Field(() => User, { nullable: true })
  user: User

  @Field({ nullable: true })
  foodId: string

  @Field(() => Food, { nullable: true })
  food: Food

  @Field({ nullable: true })
  mutagenId: string

  @Field(() => Mutagen, { nullable: true })
  mutagen: Mutagen

  @Field({ nullable: true })
  quantity: number

  @Field(() => gameDb.datatypes.UserInventoryTypeEnum, { nullable: true })
  type: gameDb.datatypes.UserInventoryTypeEnum

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class UserInventoriesList {
  @Field(() => [UserInventory], { nullable: true })
  items: UserInventory[]

  @Field({ nullable: true })
  totalCount: number
}
