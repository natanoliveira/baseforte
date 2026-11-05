import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { GeocodeDto, GeocodeService } from './geocode.service';

@Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA')
@Controller('geocode')
export class GeocodeController {
  constructor(private readonly svc: GeocodeService) {}

  @Post() @HttpCode(202)
  enqueue(@Body() dto: GeocodeDto) { return this.svc.enqueue(dto); }

  @Get('jobs/:id')
  status(@Param('id') id: string) { return this.svc.status(id); }
}
