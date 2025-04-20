import { ObjectType, Field, Int } from '@nestjs/graphql'

@ObjectType()
export class User {
  @Field({ nullable: true })
  id?: string

  @Field({ nullable: true })
  name: string

  @Field({ nullable: true })
  nameProfessor: string

  @Field({ nullable: true })
  idTelegram: string

  @Field({ nullable: true })
  email: string

  @Field({ nullable: true })
  phone: string

  @Field({ nullable: true })
  isEmailVerified: boolean

  @Field({ nullable: true })
  isPhoneVerified: boolean

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}
