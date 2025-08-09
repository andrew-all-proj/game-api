import { Module } from '@nestjs/common'
import { MonsterService } from './monster.service'
import { MonsterResolver } from './monster.resolver'
import { MonsterFeedService } from './monster-feed.service'
import { MonsterApplyMutagenService } from './monster-apply-mutagen.service'
import { MonsterApplySkillService } from './monster-apply-skill.service'

@Module({
  imports: [],
  providers: [
    MonsterResolver,
    MonsterService,
    MonsterFeedService,
    MonsterApplyMutagenService,
    MonsterApplySkillService,
  ],
})
export class MonsterModule {}
