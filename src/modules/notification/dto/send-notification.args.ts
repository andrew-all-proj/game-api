import { ArgsType, Field } from '@nestjs/graphql'
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsUUID, Length } from 'class-validator'
import { NotificationType } from '../notification.types'

@ArgsType()
export class SendNotificationArgs {
  @Field(() => NotificationType)
  @IsEnum(NotificationType)
  type: NotificationType

  @Field()
  @IsNotEmpty()
  @Length(1, 1000)
  message: string

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  publishAt?: string

  @Field(() => [String])
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[]
}
