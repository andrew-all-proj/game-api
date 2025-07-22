import { Inject, Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'
import * as gameDb from 'game-db'
import { getFileUrl } from '../../functions/get-url'
import { MonsterRedis } from '../../datatypes/common/MonsterRedis'
import { getMonsterById } from '../../functions/redis/get-monster-by-id'

const TTL = 1800

@Injectable()
export class BattleSearchService {
  private server: Server

  constructor(@Inject('REDIS_CLIENT') readonly redisClient: Redis) {}

  setServer(server: Server) {
    this.server = server
  }

  async registerMonsterForBattleSearch(
    monsterId: string,
    socketId: string,
    userId: string,
    isFindOpponent: boolean,
  ): Promise<boolean> {
    if (!isFindOpponent) {
      await this.redisClient.hset(`monster:${monsterId}`, {
        isFindOpponent: isFindOpponent ? '1' : '0',
      })
      return false
    }
    const monster = await gameDb.Entities.Monster.findOne({
      where: { id: monsterId },
      relations: ['user', 'files'],
    })

    if (!monster || monster.user.id !== userId) {
      return false
    }

    const avatarUrl = monster.files.find((file) => file.contentType === gameDb.datatypes.ContentTypeEnum.AVATAR_MONSTER)

    const monsterData: MonsterRedis = {
      socketId,
      userId: monster.userId,
      monsterId: monster.id,
      isFindOpponent: isFindOpponent ? '1' : '0',
      name: monster.name,
      level: monster.level,
      avatar: getFileUrl(avatarUrl?.url),
    }

    await this.redisClient.hset(`monster:${monsterId}`, {
      ...monsterData,
      level: monsterData.level.toString(),
    })

    await this.redisClient.expire(`monster:${monsterId}`, TTL)

    return true
  }

  async getAvailableOpponentsPaged(
    monsterId: string,
    currentUserId: string,
    cursor: string,
    limit: number,
  ): Promise<{ opponents: MonsterRedis[]; nextCursor: string }> {
    let nextCursor = cursor
    const opponents: MonsterRedis[] = []

    await this.redisClient.expire(`monster:${monsterId}`, TTL)

    do {
      const [newCursor, keys] = await this.redisClient.scan(nextCursor, 'MATCH', 'monster:*', 'COUNT', limit)
      nextCursor = newCursor

      for (const key of keys) {
        const data = await this.redisClient.hgetall(key)

        if (data.isFindOpponent === '1' && data.userId !== currentUserId) {
          opponents.push({
            monsterId: key.split(':')[1],
            userId: data.userId,
            socketId: data.socketId,
            isFindOpponent: data.isFindOpponent as '0' | '1',
            name: data.name,
            level: parseInt(data.level),
            avatar: data.avatar,
          })
        }

        if (opponents.length >= limit) {
          return { opponents, nextCursor }
        }
      }
    } while (nextCursor !== '0')

    return { opponents, nextCursor: '0' }
  }

  async requestDuelChallenge(opponentMonsterId: string): Promise<MonsterRedis | null> {
    const opponent = await getMonsterById(this.redisClient, opponentMonsterId)

    if (!opponent?.isFindOpponent) {
      return null
    }

    await this.redisClient.expire(`monster:${opponent.monsterId}`, TTL)
    return opponent
  }
}
