import * as gameDb from 'game-db'

export interface MonsterStats {
  healthPoints: number
  stamina: number
  strength: number
  defense: number
  evasion: number
}
//TODO DELETE
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

interface BattleReward {
  food?: {
    id: string
    name: string
    quantity: number
  }
  exp: number
  mutagen?: {
    id: string
    name: string
    quantity: number
  }
}

export interface BattleRedis {
  battleId: string
  opponentMonsterId: string
  challengerMonsterId: string

  opponentUserId: string
  challengerUserId: string

  challengerMonsterHp: number
  opponentMonsterHp: number

  challengerMonsterStamina: number
  opponentMonsterStamina: number

  challengerStats: MonsterStats
  opponentStats: MonsterStats

  challengerAttacks: gameDb.Entities.Skill[]
  challengerDefenses: gameDb.Entities.Skill[]
  opponentAttacks: gameDb.Entities.Skill[]
  opponentDefenses: gameDb.Entities.Skill[]

  activeDefense?: ActiveDefense

  currentTurnMonsterId: string
  turnStartTime: number
  turnTimeLimit: number
  turnNumber: number
  turnEndsAtMs: number
  graceMs: number
  serverNowMs: number
  lastActionLog?: LastActionLog
  logs?: gameDb.datatypes.BattleLog[]

  challengerSocketId: string
  opponentSocketId: string
  challengerReady: '1' | '0'
  opponentReady: '1' | '0'
  winnerMonsterId?: string
  chatId?: string | null

  opponentGetReward?: BattleReward
  challengerGetReward?: BattleReward
}
