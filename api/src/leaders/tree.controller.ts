import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { RankingService } from './ranking.service';
import { MoveLeaderDto, TreeService } from './tree.service';

// Registrado antes de LeadersController para `leaders/tree` não cair em `leaders/:id`.
@Controller('leaders')
export class TreeController {
  constructor(private readonly tree: TreeService, private readonly ranking: RankingService) {}

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA') @Get('tree')
  get() { return this.tree.tree(); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA') @Get('ranking')
  rank() { return this.ranking.ranking(); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO') @Post(':id/move') @HttpCode(200)
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveLeaderDto) { return this.tree.move(id, dto); }
}
