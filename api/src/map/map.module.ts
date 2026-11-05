import { Module } from '@nestjs/common';
import { MapController } from './map.controller';
import { ReportService } from './report.service';
import { MapService } from './map.service';

@Module({ controllers: [MapController], providers: [MapService, ReportService], exports: [MapService] })
export class MapModule {}
