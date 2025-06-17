import { Field, InputType } from '@nestjs/graphql'
import { IsArray, IsOptional, IsUUID } from 'class-validator'

@InputType()
export class UuidFilter {
  @IsUUID()
  @Field({ nullable: true })
  @IsOptional()
  eq?: string

  @Field({ nullable: true })
  @IsOptional()
  neq?: string;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  in?: string[]
}

@InputType()
export class StringFilter {
  @Field({ nullable: true })
  @IsOptional()
  eq?: string

  @Field({ nullable: true })
  @IsOptional()
  like?: string;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  in?: string[]
}

@InputType()
export class NumberFilter {
  @Field({ nullable: true })
  @IsOptional()
  eq?: number

  @Field({ nullable: true })
  @IsOptional()
  neq?: number

  @Field({ nullable: true })
  @IsOptional()
  gte?: number

  @Field({ nullable: true })
  @IsOptional()
  lte?: number;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  in?: number[]
}
