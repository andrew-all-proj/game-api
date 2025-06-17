import { Field, ArgsType, ObjectType, InputType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator'
import { StringFilter, UuidFilter } from '../../../functions/filters/filters'

@InputType()
export class SelectedPartsKey {
  @Field()
  @IsString()
  @IsNotEmpty()
  headKey: string

  @Field()
  @IsString()
  @IsNotEmpty()
  bodyKey: string

  @Field()
  @IsString()
  @IsNotEmpty()
  leftArmKey: string

  @Field({ nullable: true })
  @IsString()
  rightArmKey?: string
}

@ArgsType()
export class MonsterCreateArgs {
  @Field({ nullable: true })
  name?: string

  @IsUUID()
  @IsOptional()
  @Field({ nullable: true })
  userId?: string

  @IsUUID()
  @Field()
  fileId: string

  @Field(() => SelectedPartsKey)
  @ValidateNested()
  selectedPartsKey: SelectedPartsKey
}

@ArgsType()
export class MonstersListArgs extends PaginationArgs {
  @IsOptional()
  @Field({ nullable: true })
  id: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  userId: UuidFilter

  @IsOptional()
  @Field({ nullable: true })
  name: StringFilter
}

@ArgsType()
export class MonsterArgs {
  @IsUUID()
  @Field()
  id: string
}

@ArgsType()
export class MonsterUpdateArgs {
  @IsUUID()
  @Field()
  id: string

  @IsUUID()
  @IsOptional()
  @Field({ nullable: true })
  userId: string

  @IsOptional()
  @Field({ nullable: true })
  name: string

  @IsOptional()
  @Field({ nullable: true })
  isSelected: boolean
}

@ArgsType()
export class MonsterRemoveArgs {
  @IsUUID()
  @Field()
  id: string

  @IsUUID()
  @IsOptional()
  @Field({ nullable: true })
  userId: string
}
