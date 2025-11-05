import { Module } from '@nestjs/common'

@Module({
  imports: [RulesModule],
  providers: [RulesModule],
})
export class RulesModule {}
