import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MapModule } from './map/map.module';
import { GeocodeModule } from './geocode/geocode.module';
import { PrivacyModule } from './privacy/privacy.module';
import { ConsentModule } from './consent/consent.module';
import { SupportersModule } from './supporters/supporters.module';
import { LeadersModule } from './leaders/leaders.module';
import { CommonModule } from './common/common.module';
import { RegionsModule } from './regions/regions.module';
import { JwtGuard } from './auth/jwt.guard';
import { HealthController } from './health.controller';
import { TenancyModule } from './tenancy/tenancy.module';
import { TenantGuard } from './tenancy/tenant.guard';
import { Public } from './common/public.decorator';
import { RolesGuard } from './common/roles.guard';
import { CampaignClosedGuard } from './privacy/campaign-closed.guard';

Public()(HealthController);

@Module({
  imports: [TenancyModule, CommonModule, AuthModule, UsersModule, RegionsModule, LeadersModule, SupportersModule, ConsentModule, PrivacyModule, GeocodeModule, MapModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CampaignClosedGuard },
  ],
})
export class AppModule {}
