import { Field, ArgsType } from '@nestjs/graphql'
import { IsUUID } from 'class-validator'

@ArgsType()
export class MonsterApplyMutagenArgs {
  @IsUUID()
  @Field()
  monsterId: string

  @IsUUID()
  @Field()
  userInventoryId: string
}
