import { ObjectType, Field } from '@nestjs/graphql'
import * as gameDb from 'game-db'

@ObjectType()
export class MonsterBattles {
  @Field({ nullable: true })
  id: string

  @Field({ nullable: true })
  challengerMonsterId: string

  @Field({ nullable: true })
  opponentMonsterId: string

  @Field({ nullable: true })
  winnerMonsterId: string

  @Field(() => gameDb.datatypes.BattleStatusEnum, { nullable: true })
  status?: gameDb.datatypes.BattleStatusEnum

  @Field({ nullable: true })
  log?: string

  @Field({ nullable: true })
  updatedAt?: Date

  @Field({ nullable: true })
  createdAt?: Date
}

@ObjectType()
export class MonsterBattlesList {
  @Field(() => [MonsterBattles], { nullable: true })
  items: MonsterBattles[]

  @Field({ nullable: true })
  totalCount: number
}
