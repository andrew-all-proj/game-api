import { Module } from '@nestjs/common'
import { BattleService } from './battle.service'
import { Battle } from './battle.gateway'
import { JwtStrategy } from '../../functions/auth/jwt.strategy'
import { UserModule } from '../user/user.module'
import { RedisModule } from '../redis.module'
import { BattleAttackService } from './battle-attack.service'
import { BattleCompletedService } from './battle-completed.service'

@Module({
  imports: [UserModule, RedisModule],
  providers: [BattleService, BattleService, BattleAttackService, BattleCompletedService, Battle, JwtStrategy],
})
export class BattleModule {}
