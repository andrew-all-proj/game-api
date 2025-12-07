import { Field, ArgsType, InputType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsEmail, IsEnum, IsInt, IsOptional, IsUUID, MaxLength, ValidateNested } from 'class-validator'
import { StringFilter, UuidFilter } from '../../../functions/filters/filters'
import * as gameDb from 'game-db'

@ArgsType()
export class UserLoginArgs {
  @Field()
  initData: string

  @Field()
  telegramId: string
}

@InputType()
export class UserSelectedBodyPartInput {
  @IsInt()
  @Field()
  bodyPartId: number

  @IsInt()
  @Field()
  headPartId: number

  @IsInt()
  @Field()
  emotionPartId: number
}

@ArgsType()
export class UserCreateArgs {
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(30)
  name: string

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(30)
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
  @IsOptional()
  @MaxLength(30)
  name: string

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(30)
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

  @IsOptional()
  @ValidateNested()
  @Field(() => UserSelectedBodyPartInput, { nullable: true })
  userSelectedParts: UserSelectedBodyPartInput

  @IsOptional()
  @IsEnum(gameDb.datatypes.UserLanguage)
  @Field(() => gameDb.datatypes.UserLanguage, { nullable: true })
  language: gameDb.datatypes.UserLanguage
}

@ArgsType()
export class UserRemoveArgs {
  @IsUUID()
  @Field()
  id: string
}
