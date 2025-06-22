export interface MonsterRedis {
  monsterId: string
  userId: string
  socketId: string
  isFindOpponent: '0' | '1'
  name: string
  level: number
  avatar: string | null
}
