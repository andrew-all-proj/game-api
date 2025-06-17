import { Test, TestingModule } from '@nestjs/testing'
import { MonsterBattlesResolver } from './monster-battles.resolver'
import { MonsterBattlesService } from './monster-battles.service'

describe('MonsterBattlesResolver', () => {
  let resolver: MonsterBattlesResolver

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MonsterBattlesResolver, MonsterBattlesService],
    }).compile()

    resolver = module.get<MonsterBattlesResolver>(MonsterBattlesResolver)
  })

  it('should be defined', () => {
    expect(resolver).toBeDefined()
  })
})
