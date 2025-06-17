import { Field, ArgsType } from '@nestjs/graphql'
import { IsOptional, Max } from 'class-validator'
import { SortOrderEnum } from '../common/SortOrderEnum'

@ArgsType()
export class PaginationArgs {
  @Field()
  offset: number

  @Field()
  @Max(50, { message: 'Limit not be 50' })
  limit: number

  @Field(() => SortOrderEnum, { nullable: true })
  @IsOptional()
  sortOrder: SortOrderEnum
}
