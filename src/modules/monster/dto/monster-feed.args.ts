import { Field, ArgsType } from '@nestjs/graphql'
import { IsUUID } from 'class-validator'

@ArgsType()
export class MonsterFeedArgs {
  @IsUUID()
  @Field()
  monsterId: string

  @IsUUID()
  @Field()
  userInventoryId: string

  @Field({ nullable: true })
  quantity: number
}
