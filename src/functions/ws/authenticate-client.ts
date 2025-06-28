import { Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { JwtStrategy } from '../auth/jwt.strategy'
import { logger } from '../logger'

export async function authenticateWebSocketClient(
  client: Socket,
  jwtService: JwtService,
  jwtStrategy: JwtStrategy,
): Promise<boolean> {
  try {
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '')
    if (!token) return false

    const payload = await jwtStrategy.validate(jwtService.verify(token))
    client.data.user = payload
    return true
  } catch (err) {
    logger.warn(`WebSocket JWT validation failed:`, err.message)
    return false
  }
}
