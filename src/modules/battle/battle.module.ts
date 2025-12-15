import { Module } from '@nestjs/common'
import { BattleService } from './battle.service'
import { Battle } from './battle.gateway'
import { UserModule } from '../user/user.module'
import { RedisModule } from '../redis.module'
import { BattleAttackService } from './battle-attack.service'
import { BattleCompletedService } from './battle-completed.service'
import { BattleController } from './battle.controller'
import { JwtStrategy } from '../../functions/auth/jwt.strategy'
import { InternalJwtStrategy } from '../../functions/auth/internal-jwt.strategy'
import { RulesService } from '../rules/rules.service'
import { RabbitMqModule } from '../rabbitmq/rabbitmq.module'

@Module({
  imports: [UserModule, RedisModule, RabbitMqModule],
  controllers: [BattleController],
  providers: [
    BattleService,
    BattleAttackService,
    BattleCompletedService,
    Battle,
    JwtStrategy,
    InternalJwtStrategy,
    RulesService,
  ],
  exports: [BattleService],
})
export class BattleModule {}
