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

  handleConnection(client: Socket) {
    const isValid = authenticateWebSocketClient(
      client,
      this.jwtService,
      this.jwtStrategy,
      this.battleSerchService.redisClient,
    )
    if (!isValid) client.disconnect()
    logger.info(`Client Connected: ${client.id}`)
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
      logger.error("Register monster for battle fault, don't get user id")
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
      logger.error("Get opponents fault, don't get user id")
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
    const myMonster = await this.battleSerchService.requestDuelChallenge(data.fromMonsterId)
    const opponentMonster = await this.battleSerchService.requestDuelChallenge(data.toMonsterId)

    if (opponentMonster?.userId) {
      const opponentSocketId = await this.battleSerchService.getSocketId(opponentMonster.userId)
      if (opponentSocketId) {
        this.server.to(opponentSocketId).emit('duelChallengeRequest', myMonster)
      }
    }
  }

  @SubscribeMessage('duelAccepted')
  async handleRequestDuelChallengeAccepted(
    @MessageBody() data: { fromMonsterId: string; toMonsterId: string; duelAccepted: boolean },
  ) {
    const { fromMonsterId, toMonsterId, duelAccepted } = data

    if (!duelAccepted) {
      const challengerMonster = await getMonsterById(this.battleSerchService.redisClient, fromMonsterId)
      if (!challengerMonster) return

      const challengerSocketId = await this.battleSerchService.getSocketId(challengerMonster.userId)
      if (challengerSocketId) {
        this.server.to(challengerSocketId).emit('duelChallengeResponce', { result: false })
      }
      return
    }

    const battle = await createBattle({
      redisClient: this.battleSerchService.redisClient,
      opponentMonsterId: toMonsterId,
      challengerMonsterId: fromMonsterId,
    })

    const challengerMonster = await getMonsterById(this.battleSerchService.redisClient, fromMonsterId)
    const opponentMonster = await getMonsterById(this.battleSerchService.redisClient, toMonsterId)

    const challengerSocketId = challengerMonster
      ? await this.battleSerchService.getSocketId(challengerMonster.userId)
      : null

    const opponentSocketId = opponentMonster ? await this.battleSerchService.getSocketId(opponentMonster.userId) : null

    if (challengerSocketId) {
      this.server.to(challengerSocketId).emit('duelChallengeResponce', battle)
    }
    if (opponentSocketId) {
      this.server.to(opponentSocketId).emit('duelChallengeResponce', battle)
    }
  }
}
