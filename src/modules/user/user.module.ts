import { Module } from '@nestjs/common'
import { UserService } from './user.service'
import { UserResolver } from './user.resolver'
import { JwtModule } from '@nestjs/jwt'
import { UserApplyEnergyService } from './user-apply-energy.service'
import { S3Service } from '../upload-file/s3.service'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [UserResolver, UserService, UserApplyEnergyService, S3Service],
  exports: [JwtModule],
})
export class UserModule {}
