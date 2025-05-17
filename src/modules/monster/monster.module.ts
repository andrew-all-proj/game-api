import { Module } from '@nestjs/common'
import { MonsterService } from './monster.service'
import { MonsterResolver } from './monster.resolver'

@Module({
  imports: [],
  providers: [MonsterResolver, MonsterService],
})
export class MonsterModule {}
