import { Field, InputType } from '@nestjs/graphql'
import { IsOptional } from 'class-validator'
import * as gameDb from 'game-db'

@InputType()
export class BattleStatusFilter {
  @Field(() => gameDb.datatypes.BattleStatusEnum, { nullable: true })
  @IsOptional()
  eq?: gameDb.datatypes.BattleStatusEnum;

  @Field(() => [gameDb.datatypes.BattleStatusEnum], { nullable: true })
  @IsOptional()
  in?: gameDb.datatypes.BattleStatusEnum[]
}
