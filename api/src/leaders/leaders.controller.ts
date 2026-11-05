import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { CreateLeaderDto, ListLeadersQuery, UpdateLeaderDto } from './leaders.dto';
import { LeadersService } from './leaders.service';

@Controller('leaders')
export class LeadersController {
  constructor(private readonly svc: LeadersService) {}

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA') @Get()
  list(@Query() q: ListLeadersQuery) { return this.svc.list(q); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA') @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.get(id); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO') @Post()
  create(@Body() dto: CreateLeaderDto) { return this.svc.create(dto); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO') @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeaderDto) { return this.svc.update(id, dto); }
}
