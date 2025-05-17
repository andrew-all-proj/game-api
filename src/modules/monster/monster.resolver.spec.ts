import { Test, TestingModule } from '@nestjs/testing'
import { MonsterResolver } from './monster.resolver'
import { MonsterService } from './monster.service'

describe('UserResolver', () => {
  let resolver: MonsterResolver

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MonsterResolver, MonsterService],
    }).compile()

    resolver = module.get<MonsterResolver>(MonsterResolver)
  })

  it('should be defined', () => {
    expect(resolver).toBeDefined()
  })
})
