import { Controller, Get, Header, Param, ParseUUIDPipe, Query, StreamableFile } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID } from 'class-validator';
import { Roles } from '../common/roles.decorator';
import { MapService } from './map.service';
import { ReportService } from './report.service';

class MapQuery {
  @IsOptional() @IsUUID() coordinatorId?: string;
  @IsOptional() @IsUUID() neighborhoodId?: string;
  @IsOptional() @IsUUID() leaderId?: string;
  @IsOptional() @IsIn(['ATIVO', 'FRIO', 'INATIVO']) status?: 'ATIVO' | 'FRIO' | 'INATIVO';
  @IsOptional() @Type(() => Number) @IsInt() goalMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() goalMax?: number;
}

@Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA')
@Controller()
export class MapController {
  constructor(private readonly map: MapService, private readonly report: ReportService) {}

  @Get('map/leaders') leaders(@Query() q: MapQuery) { return this.map.leaders(q); }
  @Get('map/heatmap') heatmap(@Query() q: MapQuery) { return this.map.heatmap(q); }
  @Get('map/choropleth') choropleth() { return this.map.choropleth(); }
  @Get('map/gaps') gaps() { return this.map.gaps(); }
  @Get('map/voting-places') places() { return this.map.votingPlaces(); }
  @Get('neighborhoods/:id/panel') panel(@Param('id', ParseUUIDPipe) id: string) { return this.map.panel(id); }
  @Get('neighborhoods/:id/report.pdf')
  @Header('Content-Type', 'application/pdf') @Header('Content-Disposition', 'attachment; filename="bairro.pdf"')
  async pdf(@Param('id', ParseUUIDPipe) id: string) { return new StreamableFile(await this.report.neighborhoodPdf(id)); }
}
