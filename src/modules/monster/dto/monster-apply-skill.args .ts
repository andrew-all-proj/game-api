import { Field, ArgsType } from '@nestjs/graphql'
import { IsOptional, IsUUID } from 'class-validator'

@ArgsType()
export class MonsterApplySkillArgs {
  @IsUUID()
  @Field()
  monsterId: string

  @IsUUID()
  @Field()
  userInventoryId: string

  @IsUUID()
  @IsOptional()
  @Field({ nullable: true })
  replacedSkillId?: string
}
