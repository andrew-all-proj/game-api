import { Module } from '@nestjs/common'
import { MutagenResolver } from './mutagen.resolver'

@Module({
  providers: [MutagenResolver],
})
export class MutagenModule {}
