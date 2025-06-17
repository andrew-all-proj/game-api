import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server, Socket } from 'socket.io'
import * as gameDb from 'game-db'
import { getFileUrl } from 'src/functions/get-url'
import { In } from 'typeorm'
import { BattleSearchService } from './battleSearch.service'
import { create } from 'domain'

interface Battle {
  battleId: string
  challengerMonsterId: string
  opponentMonsterId: string
}

@Injectable()
export class BattleService {
  private server: Server

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly battleSearchService: BattleSearchService,
  ) {}

  setServer(server: Server) {
    this.server = server
  }

  async createBattle(opponentId: string, fromId: string) {
    const opponent = await this.battleSearchService.getMonsterById(opponentId)
    const monster = await this.battleSearchService.getMonsterById(fromId)

    const createBattleRedis = async (id: string) => {
      const battleData: Battle = {
        battleId: id,
        challengerMonsterId: fromId,
        opponentMonsterId: opponentId,
      }

      await this.redisClient.hset(`battle:${id}`, {
        ...battleData,
      })
    }

    const activeBattle = await gameDb.Entities.MonsterBattles.findOne({
      where: {
        challengerMonsterId: fromId,
        opponentMonsterId: opponentId,
        status: In([gameDb.datatypes.BattleStatusEnum.PENDING, gameDb.datatypes.BattleStatusEnum.ACCEPTED]),
      },
    })

    if (!opponent?.socketId || !monster?.socketId) {
      return null
    }

    if (activeBattle) {
      await createBattleRedis(activeBattle.id)
      return {
        battleId: activeBattle.id,
        opponentMonster: opponent.socketId,
        challengerMonster: monster.socketId,
      }
    }

    const battle = gameDb.Entities.MonsterBattles.create({
      challengerMonsterId: fromId,
      opponentMonsterId: opponentId,
      status: gameDb.datatypes.BattleStatusEnum.PENDING,
    })

    await battle.save()

    await createBattleRedis(battle.id)

    return {
      battleId: battle.id,
      opponentMonster: opponent.socketId,
      challengerMonster: monster.socketId,
    }
  }
}
