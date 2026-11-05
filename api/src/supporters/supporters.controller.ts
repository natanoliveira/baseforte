import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { LogAccess } from '../common/access-log.interceptor';
import { Roles } from '../common/roles.decorator';
import { CreateSupporterDto, ListSupportersQuery, UpdateSupporterDto } from './supporters.dto';
import { SupportersService } from './supporters.service';

const ALL = ['CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA'] as const;

@Roles(...ALL)
@Controller('supporters')
export class SupportersController {
  constructor(private readonly svc: SupportersService) {}

  @Get() @LogAccess('supporter', 'LIST')
  list(@Query() q: ListSupportersQuery) { return this.svc.list(q); }

  @Post() @LogAccess('supporter', 'CREATE')
  create(@Body() dto: CreateSupporterDto) { return this.svc.create(dto); }

  @Get(':id') @LogAccess('supporter', 'READ')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.get(id); }

  @Patch(':id') @LogAccess('supporter', 'UPDATE')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupporterDto) { return this.svc.update(id, dto); }
}
