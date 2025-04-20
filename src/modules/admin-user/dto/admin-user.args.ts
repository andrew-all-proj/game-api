import { InputType, Field, Int, PartialType, ArgsType } from '@nestjs/graphql'
import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator'
import * as gameDb from 'game-db'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'

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
  idTelegram?: string

  @Field(() => gameDb.datatypes.AdminRoleEnum, { nullable: true })
  role?: gameDb.datatypes.AdminRoleEnum

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
export class AdminUsersListArgs extends PaginationArgs {}
