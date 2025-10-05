import { IsNotEmpty, IsString, IsUUID } from 'class-validator'

export class CreateBattleDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'opponentMonsterId must be a valid UUID v4' })
  opponentMonsterId!: string

  @IsNotEmpty()
  @IsUUID('4', { message: 'challengerMonsterId must be a valid UUID v4' })
  challengerMonsterId!: string

  chatId?: string
}
