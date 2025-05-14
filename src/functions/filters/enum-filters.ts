import { Field, InputType } from '@nestjs/graphql'
import { IsOptional } from 'class-validator'
import * as gameDb from 'game-db'

@InputType()
export class ContentTypeFilter {
  @Field(() => gameDb.datatypes.ContentTypeEnum, { nullable: true })
  @IsOptional()
  eq?: gameDb.datatypes.ContentTypeEnum;

  @Field(() => [gameDb.datatypes.ContentTypeEnum], { nullable: true })
  @IsOptional()
  in?: gameDb.datatypes.ContentTypeEnum[]
}
