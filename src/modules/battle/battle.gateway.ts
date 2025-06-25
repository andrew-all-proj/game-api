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

  async handleConnection(client: Socket) {
    const isValid = await authenticateWebSocketClient(client, this.jwtService, this.jwtStrategy)
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

    if (!battle) return

    this.server.to(battle.challengerSocketId).emit('responseBattle', battle)
    this.server.to(battle.opponentSocketId).emit('responseBattle', battle)
  }

  @SubscribeMessage('startBattle')
  async handleStartBattle(
    @MessageBody() data: { battleId: string; monsterId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const battle = await this.battleService.startBattle(data.battleId, data.monsterId, client.id)

    if (!battle) return

    this.server.to(battle.challengerSocketId).emit('responseBattle', battle)
    this.server.to(battle.opponentSocketId).emit('responseBattle', battle)
  }

  @SubscribeMessage('attack')
  async handleAttack(
    @MessageBody() data: { battleId: string; damage: number; monsterId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const battle = await this.battleService.attack(data.battleId, data.damage, data.monsterId, client.id)
    if (!battle) return

    this.server.to(battle.challengerSocketId).emit('responseBattle', battle)
    this.server.to(battle.opponentSocketId).emit('responseBattle', battle)
  }
}
