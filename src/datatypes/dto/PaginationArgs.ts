import { Field, ArgsType } from '@nestjs/graphql'

@ArgsType()
export class PaginationArgs {
  @Field()
  offset: number

  @Field()
  limit: number
}
