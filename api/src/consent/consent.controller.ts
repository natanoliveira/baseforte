import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { LogAccess } from '../common/access-log.interceptor';
import { Roles } from '../common/roles.decorator';
import { ConsentInputDto } from '../supporters/supporters.dto';
import { ConsentService } from './consent.service';

const ALL = ['CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA'] as const;

@Roles(...ALL)
@Controller()
export class ConsentController {
  constructor(private readonly svc: ConsentService) {}

  @Post('supporters/:id/consents') @LogAccess('consent', 'GRANT')
  grant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConsentInputDto) { return this.svc.grant(id, dto); }

  @Get('communication/list') @LogAccess('communication-list', 'LIST')
  list(@Query() q: any) { return this.svc.communicationList(q); }

  @Get('communication/wa-link/:id') @LogAccess('supporter', 'WA_LINK')
  wa(@Param('id', ParseUUIDPipe) id: string, @Query('text') text?: string) { return this.svc.waLink(id, text); }
}
