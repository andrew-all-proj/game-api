import { Module } from '@nestjs/common'
import { MonsterService } from './monster.service'
import { MonsterResolver } from './monster.resolver'
import { MonsterFeedService } from './monster-feed.service'

@Module({
  imports: [],
  providers: [MonsterResolver, MonsterService, MonsterFeedService],
})
export class MonsterModule {}
