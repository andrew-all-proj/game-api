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
import { logger } from '../../functions/logger'
import { BattleAttackService } from './battle-attack.service'

@WebSocketGateway({ cors: { origin: '*' } })
export class Battle implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private server: Server

  constructor(
    private readonly battleService: BattleService,
    private readonly battleAttackService: BattleAttackService,
    private readonly jwtService: JwtService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  afterInit(server: Server) {
    this.server = server
  }

  async handleConnection(client: Socket) {
    const isValid = await authenticateWebSocketClient(
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
      await this.battleService.rejectBattle(data.battleId)
      logger.error(`[getBattle] Not found battle id ${data.battleId}`)
      return this.server.to(client.id).emit('responseBattle', { rejected: true })
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
      await this.battleService.rejectBattle(data.battleId)
      logger.error(`[startBattle] Not found battle id ${data.battleId}`)
      return this.server.to(client.id).emit('responseBattle', { rejected: true })
    }

    this.server.to(battle.challengerSocketId).emit('responseBattle', battle)
    this.server.to(battle.opponentSocketId).emit('responseBattle', battle)
  }

  @SubscribeMessage('attack')
  async handleAttack(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string
      monsterId: string
      attackId?: string | null
      defenseId?: string | null
    },
  ) {
    const battle = await this.battleAttackService.attack(
      data.battleId,
      data.attackId ?? null,
      data.defenseId ?? null,
      data.monsterId,
    )
    if (!battle) {
      await this.battleService.rejectBattle(data.battleId)
      logger.error(`[attack] Not found battle id ${data.battleId}`)
      return this.server.to(client.id).emit('responseBattle', { rejected: true })
    }

    this.server.to(battle.challengerSocketId).emit('responseBattle', battle)
    this.server.to(battle.opponentSocketId).emit('responseBattle', battle)
  }
}
