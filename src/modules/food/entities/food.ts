import { ObjectType, Field } from '@nestjs/graphql'
import { File } from '../../file/entities/file'

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
