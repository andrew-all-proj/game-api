import { ObjectType, Field } from '@nestjs/graphql'
import * as gameDb from 'game-db'

@ObjectType()
export class BattleLog {
  @Field()
  from: string

  @Field()
  to: string

  @Field()
  action: gameDb.datatypes.ActionStatusEnum

  @Field()
  nameAction: string

  @Field({ nullable: true })
  modifier?: number

  @Field({ nullable: true })
  damage?: number

  @Field({ nullable: true })
  block?: number

  @Field({ nullable: true })
  effect?: string

  @Field({ nullable: true })
  cooldown?: number

  @Field({ nullable: true })
  spCost?: number

  @Field({ nullable: true })
  turnSkip?: number

  @Field()
  timestamp: string
}

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

  @Field(() => [BattleLog], { nullable: true })
  log?: BattleLog[]

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
