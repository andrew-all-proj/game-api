import { Field, PartialType, ArgsType } from '@nestjs/graphql'
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import * as gameDb from 'game-db'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { StringFilter, UuidFilter } from '../../../functions/filters/filters'

@ArgsType()
export class AdminUserCreateArgs {
  @Field()
  @IsString()
  @MinLength(6)
  password: string

  @IsString()
  @Field()
  name: string

  @Field({ nullable: true })
  surname?: string

  @Field({ nullable: true })
  telegramId?: string

  @Field(() => gameDb.datatypes.UserRoleEnum, { nullable: true })
  role?: gameDb.datatypes.UserRoleEnum

  @IsEmail()
  @Field()
  email?: string
}

@ArgsType()
export class AdminUserUpdateArgs extends PartialType(AdminUserCreateArgs) {
  @IsUUID()
  @Field()
  id: string
}

@ArgsType()
export class AdminUserLoginArgs {
  @Field()
  @IsEmail()
  email: string

  @Field()
  @IsString()
  @MinLength(6)
  password: string
}

@ArgsType()
export class AdminUserArgs {
  @IsUUID()
  @Field()
  id: string
}

@ArgsType()
export class AdminRemoveArgs {
  @IsUUID()
  @Field()
  id: string
}

@ArgsType()
export class AdminUsersListArgs extends PaginationArgs {
  @IsOptional()
  @Field({ nullable: true })
  id: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  name: StringFilter
}
