import { Module } from '@nestjs/common'
import { BattleSearchService } from './battleSearch.service'
import { BattleGateway } from './battle.gateway'
import { JwtStrategy } from '../../functions/auth/jwt.strategy'
import { UserModule } from '../user/user.module'
import { RedisModule } from '../redis.module'
import { BattleService } from './battle.service'

@Module({
  imports: [UserModule, RedisModule],
  providers: [BattleSearchService, BattleService, BattleGateway, JwtStrategy],
})
export class BattleWsModule {}
