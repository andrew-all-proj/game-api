import * as gameDb from 'game-db'

export interface MonsterStats {
  healthPoints: number
  stamina: number
  strength: number
  defense: number
  evasion: number
}

export interface MonsterAttack {
  id: number
  name: string
  modifier: number
  energyCost: number
  cooldown: number
}

export interface MonsterDefense {
  id: number
  name: string
  modifier: number
  energyCost: number
  cooldown: number
}

interface ActiveDefense {
  monsterId: string
  action: {
    name: string
    modifier: number
    cooldown: number
    energyCost: number
  }
}

interface LastActionLog {
  monsterId: string
  actionName: string
  damage: number
  stamina: number
}

export interface BattleRedis {
  battleId: string
  opponentMonsterId: string
  challengerMonsterId: string

  challengerMonsterHp: number
  opponentMonsterHp: number

  challengerMonsterStamina: number
  opponentMonsterStamina: number

  challengerStats: MonsterStats
  opponentStats: MonsterStats

  challengerAttacks: MonsterAttack[]
  challengerDefenses: MonsterDefense[]
  opponentAttacks: MonsterAttack[]
  opponentDefenses: MonsterDefense[]

  activeDefense?: ActiveDefense

  currentTurnMonsterId: string
  turnStartTime: number
  turnTimeLimit: number
  lastActionLog?: LastActionLog
  logs?: gameDb.datatypes.BattleLog[]

  challengerSocketId: string
  opponentSocketId: string
  challengerReady: '1' | '0'
  opponentReady: '1' | '0'
  winnerMonsterId?: string
  chatId?: string | null
}
