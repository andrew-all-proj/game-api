import { Field, ArgsType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsEmail, IsOptional, IsUUID } from 'class-validator'

@ArgsType()
export class UserLoginArgs {
  @Field()
  initData: string

  @Field()
  telegramId: string
}

@ArgsType()
export class UserCreateArgs {
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
}

@ArgsType()
export class UsersListArgs extends PaginationArgs {}

@ArgsType()
export class UserArgs {
  @IsUUID()
  @Field()
  id: string
}

@ArgsType()
export class UserUpdateArgs {
  @IsUUID()
  @Field()
  id: string

  @Field({ nullable: true })
  name: string

  @Field({ nullable: true })
  nameProfessor: string

  @Field({ nullable: true })
  idTelegram: string

  @IsEmail()
  @IsOptional()
  @Field({ nullable: true })
  email: string

  @Field({ nullable: true })
  phone: string
}

@ArgsType()
export class UserRemoveArgs {
  @IsUUID()
  @Field()
  id: string
}
