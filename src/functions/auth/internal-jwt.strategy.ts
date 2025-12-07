import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Request } from 'express'

interface InternalJwtPayload {
  sub?: string
  type?: string
  [key: string]: unknown
}

@Injectable()
export class InternalJwtStrategy extends PassportStrategy(Strategy, 'internal-jwt') {
  constructor() {
    if (!process.env.INTERNAL_JWT_SECRET) {
      console.warn('[InternalJwt] INTERNAL_JWT_SECRET is not set')
      throw new Error('INTERNAL_JWT_SECRET must be set')
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request | undefined) => {
          const token = req?.headers?.['x-internal-token']
          return typeof token === 'string' ? token : null // X-Internal-Token: <jwt>
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.INTERNAL_JWT_SECRET,
      algorithms: ['HS256'],
      ignoreExpiration: false,
      //   audience: process.env.INTERNAL_JWT_AUDIENCE || undefined,
      //   issuer: process.env.INTERNAL_JWT_ISSUER || undefined,
    })

    if (!process.env.INTERNAL_JWT_SECRET) {
      console.warn('[InternalJwt] INTERNAL_JWT_SECRET is not set')
    }
  }

  validate(payload: InternalJwtPayload) {
    const requiredType = process.env.INTERNAL_JWT_TYPE
    if (requiredType && payload?.type !== requiredType) {
      throw new UnauthorizedException('Invalid token type for internal route')
    }

    return { internal: true, sub: payload?.sub, ...payload }
  }
}
