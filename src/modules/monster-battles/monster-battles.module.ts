import { Module } from '@nestjs/common'
import { MonsterBattlesService } from './monster-battles.service'
import { MonsterBattlesResolver } from './monster-battles.resolver'

@Module({
  imports: [],
  providers: [MonsterBattlesService, MonsterBattlesResolver],
})
export class MonsterBattlesModule {}
