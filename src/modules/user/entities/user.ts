import { ObjectType, Field } from '@nestjs/graphql'
import { File } from '../../../modules/file/entities/file'
import { UserInventory } from '../../user-inventory/entities/user-inventory'
import * as gameDb from 'game-db'

@ObjectType()
export class User {
  @Field({ nullable: true })
  id?: string

  @Field({ nullable: true })
  name: string

  @Field({ nullable: true })
  nameProfessor: string

  @Field({ nullable: true })
  telegramId: string

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

  @Field({ nullable: true })
  energy: number

  @Field({ nullable: true })
  lastEnergyUpdate?: Date

  @Field({ nullable: true })
  avatarFileId: string

  @Field(() => File, { nullable: true })
  avatar: File

  @Field(() => gameDb.datatypes.UserLanguage, { nullable: true })
  language: gameDb.datatypes.UserLanguage

  @Field(() => [UserInventory], { nullable: true })
  userInventories?: UserInventory[]

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class UserLogin {
  @Field({ nullable: true })
  token: string

  @Field({ nullable: true })
  id: string

  @Field({ nullable: true })
  nameProfessor: string

  @Field({ nullable: true })
  isRegistered: boolean

  @Field({ nullable: true })
  energy: number

  @Field(() => gameDb.datatypes.UserLanguage, { nullable: true })
  language: gameDb.datatypes.UserLanguage

  @Field(() => File, { nullable: true })
  avatar: File
}

@ObjectType()
export class UsersList {
  @Field(() => [User], { nullable: true })
  items: User[]

  @Field({ nullable: true })
  totalCount: number
}
