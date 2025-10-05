import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

@Injectable()
export class InternalJwtStrategy extends PassportStrategy(Strategy, 'internal-jwt') {
  constructor() {
    if (!process.env.INTERNAL_JWT_SECRET) {
      // eslint-disable-next-line no-console
      console.warn('[InternalJwt] INTERNAL_JWT_SECRET is not set')
      throw new Error('INTERNAL_JWT_SECRET must be set')
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => (req?.headers['x-internal-token'] as string) || null, // X-Internal-Token: <jwt>
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.INTERNAL_JWT_SECRET,
      algorithms: ['HS256'],
      ignoreExpiration: false,
      //   audience: process.env.INTERNAL_JWT_AUDIENCE || undefined,
      //   issuer: process.env.INTERNAL_JWT_ISSUER || undefined,
    })

    if (!process.env.INTERNAL_JWT_SECRET) {
      // eslint-disable-next-line no-console
      console.warn('[InternalJwt] INTERNAL_JWT_SECRET is not set')
    }
  }

  async validate(payload: any) {
    const requiredType = process.env.INTERNAL_JWT_TYPE // напр. "internal"
    if (requiredType && payload?.type !== requiredType) {
      throw new UnauthorizedException('Invalid token type for internal route')
    }

    return { internal: true, sub: payload?.sub, ...payload }
  }
}
