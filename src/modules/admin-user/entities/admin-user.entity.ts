import { ObjectType, Field } from '@nestjs/graphql'
import * as gameDb from 'game-db'

@ObjectType()
export class AdminUser {
  @Field({ nullable: true })
  id?: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  surname?: string

  @Field({ nullable: true })
  idTelegram?: string

  @Field(() => gameDb.datatypes.UserRoleEnum, { nullable: true })
  role?: gameDb.datatypes.UserRoleEnum

  @Field({ nullable: true })
  email?: string

  @Field({ nullable: true })
  phone?: string

  @Field({ nullable: true })
  isEmailVerified?: boolean

  @Field({ nullable: true })
  isPhoneVerified?: boolean

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class AdminUserLogin {
  @Field({ nullable: true })
  token: string

  @Field({ nullable: true })
  id: string

  @Field(() => gameDb.datatypes.UserRoleEnum, { nullable: true })
  role?: gameDb.datatypes.UserRoleEnum
}

@ObjectType()
export class AdminUsersList {
  @Field(() => [AdminUser], { nullable: true })
  items: AdminUser[]

  @Field({ nullable: true })
  totalCount: number
}
