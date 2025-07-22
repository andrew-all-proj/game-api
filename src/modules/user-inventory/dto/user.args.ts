import { Field, ArgsType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsNotEmpty, IsOptional, IsUUID, ValidateIf } from 'class-validator'
import { StringFilter, UuidFilter } from '../../../functions/filters/filters'
import { UserInventoryTypeFilter } from './inputType'

@ArgsType()
export class UserInventoryCreateArgs {
  @Field({ nullable: true })
  userId: string

  @Field({ nullable: true })
  @IsOptional()
  @ValidateIf((o) => !o.mutagenId)
  @IsNotEmpty({ message: 'foodId is required if mutagenId is not provided' })
  foodId: string

  @Field({ nullable: true })
  @IsOptional()
  @ValidateIf((o) => !o.foodId)
  @IsNotEmpty({ message: 'mutagenId is required if foodId is not provided' })
  mutagenId: string

  @Field({ nullable: true })
  quantity: number
}

@ArgsType()
export class UserInventoriesListArgs extends PaginationArgs {
  @IsOptional()
  @Field({ nullable: true })
  id: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  userId: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  name: StringFilter

  @IsOptional()
  @Field({ nullable: true })
  type?: UserInventoryTypeFilter
}

@ArgsType()
export class UserInventoryArgs {
  @IsUUID()
  @Field()
  id: string
}

@ArgsType()
export class UserInventoryUpdateArgs {
  @IsUUID()
  @Field()
  id: string

  @Field({ nullable: true })
  @IsOptional()
  quantity: number
}

@ArgsType()
export class UserRemoveArgs {
  @IsUUID()
  @Field()
  id: string
}
