import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { Roles } from '../common/roles.decorator';
import { RegionsService } from './regions.service';

class MoveDto {
  @IsUUID() regionId!: string;
}

@Controller()
export class RegionsController {
  constructor(private readonly svc: RegionsService) {}

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA')
  @Get('regions') regions() { return this.svc.listRegions(); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA')
  @Get('neighborhoods') neighborhoods() { return this.svc.listNeighborhoods(); }

  @Roles('CANDIDATO', 'COORD_GERAL')
  @Patch('neighborhoods/:id/region')
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDto) { return this.svc.moveNeighborhood(id, dto.regionId); }
}
