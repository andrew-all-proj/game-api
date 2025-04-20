import { Module } from '@nestjs/common'
import { AdminUserService } from './admin-user.service'
import { AdminUserResolver } from './admin-user.resolver'
import { AuthService } from './auth.service'
import { JwtModule } from '@nestjs/jwt'
import { JwtStrategy } from '../../functions/auth'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AdminUserResolver, AdminUserService, AuthService, JwtStrategy],
})
export class AdminUserModule {}
