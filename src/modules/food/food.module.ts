import { Module } from '@nestjs/common'
import { FoodService } from './food.service'
import { FoodResolver } from './food.resolver'
import { RulesService } from '../rules/rules.service'

@Module({
  providers: [FoodResolver, FoodService, RulesService],
})
export class FoodModule {}
