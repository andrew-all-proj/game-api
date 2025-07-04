import { Socket as DefaultSocket } from 'socket.io'
import { JwtPayload } from './JwtPayload'

export interface AuthenticatedSocket extends DefaultSocket {
  data: JwtPayload
}
