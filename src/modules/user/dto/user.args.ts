import { Field, ArgsType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsEmail, IsOptional, IsUUID } from 'class-validator'
import { StringFilter, UuidFilter } from '../../../functions/filters/filters'

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
  telegramId: string

  @IsEmail()
  @IsOptional()
  @Field({ nullable: true })
  email: string

  @Field({ nullable: true })
  phone: string

  @Field({ nullable: true })
  isEmailVerified: boolean

  @Field({ nullable: true })
  isPhoneVerified: boolean

  @Field({ nullable: true })
  isRegistered: boolean

  @IsUUID()
  @IsOptional()
  @Field({ nullable: true })
  avatarFileId: string
}

@ArgsType()
export class UsersListArgs extends PaginationArgs {
  @IsOptional()
  @Field({ nullable: true })
  id: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  name: StringFilter
}

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
  telegramId: string

  @IsEmail()
  @IsOptional()
  @Field({ nullable: true })
  email: string

  @Field({ nullable: true })
  phone: string

  @Field({ nullable: true })
  isRegistered: boolean

  @IsUUID()
  @IsOptional()
  @Field({ nullable: true })
  avatarFileId: string
}

@ArgsType()
export class UserRemoveArgs {
  @IsUUID()
  @Field()
  id: string
}
