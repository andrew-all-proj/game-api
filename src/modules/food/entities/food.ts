import { ObjectType, Field } from '@nestjs/graphql'
import { File } from '../../file/entities/file'
import { FoodTranslate } from './food-translate'

@ObjectType()
export class Food {
  @Field({ nullable: true })
  id: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: true })
  iconFileId: string

  @Field(() => File, { nullable: true })
  iconFile?: File

  @Field({ nullable: true })
  satietyBonus: number

  @Field(() => [FoodTranslate], { nullable: true })
  translations?: FoodTranslate[]

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class FoodsList {
  @Field(() => [Food], { nullable: true })
  items: Food[]

  @Field({ nullable: true })
  totalCount: number
}

@ObjectType()
export class GetFoodToday {
  @Field({ nullable: true })
  message: string

  @Field({ nullable: true })
  quantity: number

  @Field({ nullable: true })
  userInventoryId?: string

  @Field(() => Food, { nullable: true })
  food?: Food
}
