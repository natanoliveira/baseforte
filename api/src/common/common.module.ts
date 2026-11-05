import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AccessLogInterceptor } from './access-log.interceptor';
import { AccessLogService } from './access-log.service';
import { GeoRepository } from './geo.repository';
import { SensitiveDataService } from './sensitive-data.service';

@Global()
@Module({
  providers: [SensitiveDataService, GeoRepository, AccessLogService, { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor }],
  exports: [SensitiveDataService, GeoRepository, AccessLogService],
})
export class CommonModule {}
