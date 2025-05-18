import { Module } from '@nestjs/common'
import { UploadController } from './upload-file.controller'

@Module({
  controllers: [UploadController],
})
export class UploadModule {}
