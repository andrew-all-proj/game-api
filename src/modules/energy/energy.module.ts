import { Module } from '@nestjs/common'
import { EnergyResolver } from './energy.resolver'

@Module({
  providers: [EnergyResolver],
})
export class EnergyModule {}
