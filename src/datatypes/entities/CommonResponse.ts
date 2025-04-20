import { ObjectType, Field } from '@nestjs/graphql'

@ObjectType()
export class ErrorResponse {
  @Field({ nullable: true })
  message: string

  @Field({ nullable: true })
  error?: string
}

@ObjectType()
export class CommonResponse {
  @Field({ nullable: true })
  success: boolean

  @Field({ nullable: true })
  error?: ErrorResponse
}
