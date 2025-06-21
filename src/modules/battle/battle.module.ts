import { Module } from '@nestjs/common'
import { BattleService } from './battle.service'
import { Battle } from './battle.gateway'
import { JwtStrategy } from '../../functions/auth/jwt.strategy'
import { UserModule } from '../user/user.module'
import { RedisModule } from '../redis.module'

@Module({
  imports: [UserModule, RedisModule],
  providers: [BattleService, BattleService, Battle, JwtStrategy],
})
export class BattleModule {}
