import { Module } from '@nestjs/common'
import { FoodService } from './food.service'
import { FoodResolver } from './food.resolver'

@Module({
  providers: [FoodResolver, FoodService],
})
export class FoodModule {}
