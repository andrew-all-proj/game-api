import { Module } from '@nestjs/common'
import { UserService } from './user.service'
import { UserResolver } from './user.resolver'
import { JwtModule } from '@nestjs/jwt'
import { UserApplyEnergyService } from './user-apply-energy.service'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [UserResolver, UserService, UserApplyEnergyService],
  exports: [JwtModule],
})
export class UserModule {}
