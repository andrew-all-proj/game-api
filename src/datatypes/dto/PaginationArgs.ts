import { Field, ArgsType } from '@nestjs/graphql'
import { IsOptional } from 'class-validator'
import { SortOrderEnum } from '../common/SortOrderEnum'

@ArgsType()
export class PaginationArgs {
  @Field()
  offset: number

  @Field()
  limit: number

  @Field(() => SortOrderEnum, { nullable: true })
  @IsOptional()
  sortOrder: SortOrderEnum
}
