import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import * as gameDb from 'game-db'
import { AdminUserLoginArgs } from './dto/admin-user.args'
import { AdminUserLogin } from './entities/admin-user.entity'

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(loginDto: AdminUserLoginArgs) {
    const user = await gameDb.Entities.AdminUser.findOneBy({
      email: loginDto.email,
    })

    if (!user || !user.password || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials')
    }

    return user
  }

  async login(loginDto: AdminUserLoginArgs): Promise<AdminUserLogin> {
    const user = await this.validateUser(loginDto)

    const payload = {
      sub: user.id,
      role: user.role,
    }

    const token = this.jwtService.sign(payload)

    return {
      token: token,
      id: user.id,
      role: user.role,
    }
  }
}
