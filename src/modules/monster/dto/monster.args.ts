import { Field, ArgsType } from '@nestjs/graphql'
import { PaginationArgs } from '../../../datatypes/dto/PaginationArgs'
import { IsOptional, IsUUID } from 'class-validator'
import { StringFilter, UuidFilter } from '../../../functions/filters/filters'

@ArgsType()
export class MonsterCreateArgs {
  @Field({ nullable: true })
  name: string

  @IsUUID()
  @IsOptional()
  @Field({ nullable: true })
  userId: string

  @IsUUID()
  @Field({ nullable: true })
  fileId: string
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
