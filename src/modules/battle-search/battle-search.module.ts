import { Module } from '@nestjs/common'
import { BattleSearchService } from './battle-search.service'
import { BattleSearch } from './battle-search.gateway'
import { JwtStrategy } from '../../functions/auth/jwt.strategy'
import { UserModule } from '../user/user.module'
import { RedisModule } from '../redis.module'

@Module({
  imports: [UserModule, RedisModule],
  providers: [BattleSearchService, BattleSearch, JwtStrategy],
})
export class BattleSearchModule {}
