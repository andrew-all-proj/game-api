import { ObjectType, Field } from '@nestjs/graphql'
import { File } from '../../file/entities/file'

@ObjectType()
export class Energy {
  @Field({ nullable: true })
  id: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  quantity?: number

  @Field({ nullable: true })
  priceMinor?: number

  @Field({ nullable: true })
  isActive: boolean

  // @Field({ nullable: true }) //TODO add later
  // iconFileId: string

  // @Field(() => File, { nullable: true })
  // iconFile?: File

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class EnegiesList {
  @Field(() => [Energy], { nullable: true })
  items: Energy[]

  @Field({ nullable: true })
  totalCount: number
}
