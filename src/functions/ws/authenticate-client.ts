import { JwtService } from '@nestjs/jwt'
import { JwtStrategy } from '../auth/jwt.strategy'
import { logger } from '../logger'
import { AuthenticatedSocket } from '../../datatypes/common/AuthenticatedSocket'
import { JwtPayload } from '../auth/jwt.strategy'
import { Redis } from 'ioredis'

export async function authenticateWebSocketClient(
  client: AuthenticatedSocket,
  jwtService: JwtService,
  jwtStrategy: JwtStrategy,
  redisClient: Redis,
): Promise<boolean> {
  try {
    const token = String(
      client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', ''),
    )
    if (!token) return false

    const decoded = jwtService.verify<JwtPayload>(token)
    const payload = jwtStrategy.validate(decoded)

    client.data.user = payload

    await redisClient.hset(`user:${payload.id}`, 'socketId', client.id)

    await redisClient.expire(`user:${payload.id}`, 1800)

    return true
  } catch (err) {
    if (err instanceof Error) {
      logger.warn(`WebSocket JWT validation failed:`, err.message)
    } else {
      logger.warn(`WebSocket JWT validation failed:`, String(err))
    }
    return false
  }
}
