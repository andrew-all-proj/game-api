import { Field, InputType } from '@nestjs/graphql'
import { IsOptional } from 'class-validator'
import * as gameDb from 'game-db'

@InputType()
export class UserInventoryTypeFilter {
  @Field(() => gameDb.datatypes.UserInventoryTypeEnum, { nullable: true })
  @IsOptional()
  eq?: gameDb.datatypes.UserInventoryTypeEnum;

  @Field(() => [gameDb.datatypes.UserInventoryTypeEnum], { nullable: true })
  @IsOptional()
  in?: gameDb.datatypes.UserInventoryTypeEnum[]
}
