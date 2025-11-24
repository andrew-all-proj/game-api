import { Field, ArgsType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsEnum, IsOptional, IsUUID } from 'class-validator'
import { UuidFilter } from '../../../functions/filters/filters'
import * as gameDb from 'game-db'

@ArgsType()
export class SkillsListArgs extends PaginationArgs {
  @IsOptional()
  @Field({ nullable: true })
  id: UuidFilter

  @IsOptional()
  @IsEnum(gameDb.datatypes.UserLanguage)
  @Field(() => gameDb.datatypes.UserLanguage, { nullable: true })
  language?: gameDb.datatypes.UserLanguage
}

@ArgsType()
export class SkillArgs {
  @IsUUID()
  @Field()
  id: string

  @IsOptional()
  @IsEnum(gameDb.datatypes.UserLanguage)
  @Field(() => gameDb.datatypes.UserLanguage, { nullable: true })
  language?: gameDb.datatypes.UserLanguage
}
