import { Test, TestingModule } from '@nestjs/testing'
import { AdminUserResolver } from './admin-user.resolver'
import { AdminUserService } from './admin-user.service'

describe('AdminUserResolver', () => {
  let resolver: AdminUserResolver

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminUserResolver, AdminUserService],
    }).compile()

    resolver = module.get<AdminUserResolver>(AdminUserResolver)
  })

  it('should be defined', () => {
    expect(resolver).toBeDefined()
  })
})
