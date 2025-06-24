export interface BattleRedis {
  battleId: string
  opponentMonsterId: string
  challengerMonsterId: string
  challengerMonsterHp: number
  opponentMonsterHp: number
  currentTurnMonsterId: string
  turnStartTime: number
  turnTimeLimit: number
  lastActionLog?: string
  logs?: string
  challengerSocketId: string
  opponentSocketId: string
  challengerReady: '0' | '1'
  opponentReady: '0' | '1'
  winnerMonsterId?: string
  chatId?: string | null
}
