import { Field, ArgsType } from '@nestjs/graphql'
import { IsUUID } from 'class-validator'

@ArgsType()
export class UserApplyEnergyArgs {
  @IsUUID()
  @Field()
  userId: string

  @IsUUID()
  @Field()
  userInventoryId: string
}
