import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CloseCampaignService } from './close-campaign.service';
import { PrivacyController } from './privacy.controller';
import { RopaService } from './ropa.service';
import { RemovalController } from './removal.controller';
import { RemovalService } from './removal.service';
import { TitularService } from './titular.service';

@Module({ controllers: [RemovalController, PrivacyController], providers: [RemovalService, TitularService, AuditService, RopaService, CloseCampaignService], exports: [RemovalService] })
export class PrivacyModule {}
