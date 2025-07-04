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
import { BattleSearchService } from './battle-search.service'
import { JwtStrategy } from '../../functions/auth/jwt.strategy'
import { JwtService } from '@nestjs/jwt'
import { authenticateWebSocketClient } from '../../functions/ws/authenticate-client'
import { getMonsterById } from '../../functions/redis/get-monster-by-id'
import { createBattle } from '../../functions/create-battle'
import { logger } from '../../functions/logger'
import { AuthenticatedSocket } from '../../datatypes/common/AuthenticatedSocket'

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class BattleSearch implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private server: Server

  constructor(
    private readonly battleSerchService: BattleSearchService,
    private readonly jwtService: JwtService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  afterInit(server: Server) {
    this.server = server
  }

  async handleConnection(client: Socket) {
    const isValid = await authenticateWebSocketClient(client, this.jwtService, this.jwtStrategy)
    if (!isValid) client.disconnect()
  }

  handleDisconnect(client: Socket) {
    logger.info(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('registerMonsterForBattle')
  async handleRegisterMonsterForBattle(
    @MessageBody() data: { monsterId: string; isFindOpponent: boolean },
    @ConnectedSocket() client: AuthenticatedSocket,
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
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.user?.id
    if (!userId) {
      client.emit('opponents', { opponents: [], nextCursor: '0' })
      return
    }

    const { opponents, nextCursor } = await this.battleSerchService.getAvailableOpponentsPaged(
      data.monsterId,
      userId,
      data.cursor ?? '0',
      data.limit ?? 10,
    )

    client.emit('opponents', { opponents, nextCursor })
  }

  @SubscribeMessage('requestDuelChallenge')
  async handleRequestDuelChallenge(@MessageBody() data: { fromMonsterId: string; toMonsterId: string }) {
    const monsterOpponent = await this.battleSerchService.requestDuelChallenge(data.toMonsterId)
    const monster = await this.battleSerchService.requestDuelChallenge(data.fromMonsterId)

    if (monsterOpponent?.socketId) {
      this.server.to(monsterOpponent.socketId).emit('duelChallengeRequest', monster)
    }
  }

  @SubscribeMessage('duelAccepted')
  async handleRequestDuelChallengeAccepted(
    @MessageBody() data: { fromMonsterId: string; toMonsterId: string; duelAccepted: boolean },
  ) {
    if (!data.duelAccepted) {
      const monsterOpponent = await getMonsterById(this.battleSerchService.redisClient, data.fromMonsterId)
      if (!monsterOpponent) return
      this.server.to(monsterOpponent.socketId).emit('duelChallengeResponce', { result: false })
      return
    }

    const battle = await createBattle({
      redisClient: this.battleSerchService.redisClient,
      opponentMonsterId: data?.toMonsterId,
      challengerMonsterId: data?.fromMonsterId,
    })

    if (battle.challengerSocketId) {
      this.server.to(battle.challengerSocketId).emit('duelChallengeResponce', battle)
    }
    if (battle.opponentSocketId) {
      this.server.to(battle.opponentSocketId).emit('duelChallengeResponce', battle)
    }
  }
}
