import { Field, ArgsType } from '@nestjs/graphql'

@ArgsType()
export class UserLoginArgs {
  @Field()
  initData: string

  @Field()
  telegramId: string
}
