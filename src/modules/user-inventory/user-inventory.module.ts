import { Module } from '@nestjs/common'
import { UserInventoryService } from './user-inventory.service'
import { UserInventoryResolver } from './user-inventory.resolver'

@Module({
  imports: [],
  providers: [UserInventoryService, UserInventoryResolver],
})
export class UserInventoryModule {}
