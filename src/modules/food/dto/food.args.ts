import { Field, ArgsType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsOptional, IsUUID } from 'class-validator'
import { UuidFilter } from '../../../functions/filters/filters'

@ArgsType()
export class FoodsListArgs extends PaginationArgs {
  @IsOptional()
  @Field({ nullable: true })
  id: UuidFilter
}

@ArgsType()
export class FoodArgs {
  @IsUUID()
  @Field()
  id: string
}

@ArgsType()
export class GetFoodTodayArgs {
  @IsUUID()
  @Field()
  userId: string
}
