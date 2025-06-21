import { Redis } from 'ioredis'
import { MonsterRedis } from '../../datatypes/common/MonsterRedis'

export async function getMonsterById(redisClient: Redis, monsterId: string): Promise<MonsterRedis | null> {
  const data = await redisClient.hgetall(`monster:${monsterId}`)
  if (!data || Object.keys(data).length === 0) return null

  return {
    monsterId,
    userId: data.userId,
    socketId: data.socketId,
    isFindOpponent: data.isFindOpponent as '0' | '1',
    name: data.name,
    level: parseInt(data.level),
    avatar: data.avatar,
  }
}
