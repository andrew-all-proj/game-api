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
import { BattleService } from './battle.service'
import { JwtStrategy } from '../../functions/auth/jwt.strategy'
import { JwtService } from '@nestjs/jwt'
import { authenticateWebSocketClient } from '../../functions/ws/authenticate-client'
import * as gameDb from 'game-db'
import { logger } from '../../functions/logger'

@WebSocketGateway({ cors: { origin: '*' } })
export class Battle implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private server: Server

  constructor(
    private readonly battleService: BattleService,
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
      this.battleService.redisClient,
    )
    if (!isValid) client.disconnect()
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('getBattle')
  async handleGetBattle(
    @MessageBody() data: { battleId: string; monsterId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const battle = await this.battleService.getBattle(data.battleId, data.monsterId, client.id)

    if (!battle) {
      logger.error(`Not found battle id ${data.battleId}`)
      return
    }

    this.server.to(battle.challengerSocketId).emit('responseBattle', battle)
    this.server.to(battle.opponentSocketId).emit('responseBattle', battle)
  }

  @SubscribeMessage('startBattle')
  async handleStartBattle(
    @MessageBody() data: { battleId: string; monsterId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const battle = await this.battleService.startBattle(data.battleId, data.monsterId, client.id)

    if (!battle) {
      logger.error(`Not found battle id ${data.battleId}`)
      return
    }

    this.server.to(battle.challengerSocketId).emit('responseBattle', battle)
    this.server.to(battle.opponentSocketId).emit('responseBattle', battle)
  }

  @SubscribeMessage('attack')
  async handleAttack(
    @MessageBody()
    data: {
      battleId: string
      actionId: number
      actionType: gameDb.datatypes.ActionStatusEnum
      monsterId: string
    },
  ) {
    const battle = await this.battleService.attack(data.battleId, data.actionId, data.actionType, data.monsterId)
    if (!battle) {
      logger.error(`Not found battle id ${data.battleId}`)
      return
    }

    this.server.to(battle.challengerSocketId).emit('responseBattle', battle)
    this.server.to(battle.opponentSocketId).emit('responseBattle', battle)
  }
}
