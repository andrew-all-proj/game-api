import { Field, ArgsType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsOptional, IsUUID } from 'class-validator'
import { UuidFilter } from '../../../functions/filters/filters'
import { BattleStatusFilter } from './inputType'
import * as gameDb from 'game-db'

@ArgsType()
export class MonsterBattlesListArgs extends PaginationArgs {
  @IsOptional()
  @Field({ nullable: true })
  id: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  challengerMonsterId: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  opponentMonsterId: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  winnerId: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  status: BattleStatusFilter
}

@ArgsType()
export class MonsterBattlesArgs {
  @IsUUID()
  @Field()
  id: string
}

@ArgsType()
export class MonsterBattlesUpdateArgs {
  @IsUUID()
  @Field()
  id: string

  @IsOptional()
  @Field(() => gameDb.datatypes.BattleStatusEnum, { nullable: true })
  status: gameDb.datatypes.BattleStatusEnum
}

@ArgsType()
export class MonsterBattlesRemoveArgs {
  @IsUUID()
  @Field()
  id: string
}
