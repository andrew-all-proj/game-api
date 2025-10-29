import { Field, ArgsType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsOptional, IsUUID } from 'class-validator'
import { UuidFilter } from '../../../functions/filters/filters'

@ArgsType()
export class SkillsListArgs extends PaginationArgs {
  @IsOptional()
  @Field({ nullable: true })
  id: UuidFilter
}

@ArgsType()
export class SkillArgs {
  @IsUUID()
  @Field()
  id: string
}
