import { Controller, Post, Body, UseGuards } from '@nestjs/common'
import { BattleService } from './battle.service'
import { BattleCompletedService } from './battle-completed.service'
import { CreateBattleDto } from './dto/create-battle.dto'
import { InternalJwtAuthGuard } from '../../functions/auth/internal-jwt.guard'

@Controller('battle')
export class BattleController {
  constructor(
    private readonly battleService: BattleService,
    private readonly battleCompletedService: BattleCompletedService,
  ) {}

  @Post('create-battle')
  @UseGuards(InternalJwtAuthGuard)
  async createBattle(@Body() dto: CreateBattleDto): Promise<{ id: string | null }> {
    const id = await this.battleService.createBattle(dto.opponentMonsterId, dto.challengerMonsterId, dto.chatId)
    return { id }
  }
}
