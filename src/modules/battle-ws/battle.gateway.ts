import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Socket, Server } from 'socket.io'
import { BattleSearchService } from './battleSearch.service'
import { JwtStrategy } from '../../functions/auth/jwt.strategy'
import { JwtService } from '@nestjs/jwt'
import { BattleService } from './battle.service'

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class BattleGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private server: Server

  constructor(
    private readonly battleSerchService: BattleSearchService,
    private readonly battleService: BattleService,
    private readonly jwtService: JwtService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  afterInit(server: Server) {
    this.server = server
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '')
      if (!token) {
        client.disconnect()
        return
      }
      const payload = await this.jwtStrategy.validate(this.jwtService.verify(token))
      client.data.user = payload
    } catch (err) {
      console.warn(`JWT validation failed:`, err.message)
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('registerMonsterForBattle')
  async handleRegisterMonsterForBattle(
    @MessageBody() data: { monsterId: string; isFindOpponent: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.id
    if (!userId || !data.monsterId) {
      client.emit('registerMonster', { result: false })
      return
    }

    const result = await this.battleSerchService.registerMonsterForBattleSearch(
      data.monsterId,
      client.id,
      userId,
      data.isFindOpponent,
    )

    client.emit('registerMonster', { result })
  }

  @SubscribeMessage('getOpponents')
  async handleGetOpponents(
    @MessageBody() data: { monsterId: string; cursor?: string; limit?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.id
    if (!userId) {
      client.emit('opponents', { opponents: [], nextCursor: '0' })
      return
    }

    const { opponents, nextCursor } = await this.battleSerchService.getAvailableOpponentsPaged(
      userId,
      data.cursor ?? '0',
      data.limit ?? 10,
    )

    client.emit('opponents', { opponents, nextCursor })
  }

  @SubscribeMessage('requestDuelChallenge')
  async handleRequestDuelChallenge(
    @MessageBody() data: { fromMonsterId: string; toMonsterId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const monsterOpponent = await this.battleSerchService.requestDuelChallenge(data.toMonsterId)
    const monster = await this.battleSerchService.requestDuelChallenge(data.fromMonsterId)

    if (monsterOpponent?.socketId) {
      this.server.to(monsterOpponent.socketId).emit('duelChallengeRequest', monster)
    }
  }

  @SubscribeMessage('duelAccepted')
  async handleRequestDuelChallengeAccepted(
    @MessageBody() data: { fromMonsterId: string; toMonsterId: string; duelAccepted: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.duelAccepted) {
      const monsterOpponent = await this.battleSerchService.getMonsterById(data.fromMonsterId)
      if (!monsterOpponent) return
      this.server.to(monsterOpponent.socketId).emit('duelChallengeResponce', { result: false })
      return
    }

    const battle = await this.battleService.createBattle(data.toMonsterId, data.fromMonsterId)
    if (!battle) {
      return null
    }

    this.server.to(battle.challengerMonster).emit('duelChallengeResponce', { result: true, battleId: battle.battleId })
    this.server.to(battle.opponentMonster).emit('duelChallengeResponce', { result: true, battleId: battle.battleId })
  }
}
