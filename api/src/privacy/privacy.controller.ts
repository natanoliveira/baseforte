import { Body, Controller, Get, Header, HttpCode, NotFoundException, Param, Post, Put, Query, StreamableFile } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Public } from '../common/public.decorator';
import { Roles } from '../common/roles.decorator';
import { PrismaService } from '../tenancy/prisma.service';
import { AuditService } from './audit.service';
import { CloseCampaignDto, CloseCampaignService, RetentionDto } from './close-campaign.service';
import { UpdateDpoDto } from './dpo.dto';
import { RopaService } from './ropa.service';

@Controller()
export class PrivacyController {
  constructor(
    private readonly prisma: PrismaService, private readonly cls: ClsService,
    private readonly audit: AuditService, private readonly ropa: RopaService, private readonly closer: CloseCampaignService,
  ) {}

  @Roles('CANDIDATO', 'COORD_GERAL', 'AUDITOR') @Get('privacy/dpo')
  async dpo() {
    const c = await this.prisma.campaign.findUniqueOrThrow({ where: { id: this.cls.get('campaignId') } });
    return { dpoName: c.dpoName, dpoEmail: c.dpoEmail, dpoContact: c.dpoContact };
  }

  @Roles('CANDIDATO', 'COORD_GERAL') @Put('privacy/dpo')
  async setDpo(@Body() dto: UpdateDpoDto) {
    const c = await this.prisma.campaign.update({ where: { id: this.cls.get('campaignId') }, data: dto });
    return { dpoName: c.dpoName, dpoEmail: c.dpoEmail, dpoContact: c.dpoContact };
  }

  @Public() @Get('public/dpo/:slug')
  async publicDpo(@Param('slug') slug: string) {
    const c = await this.prisma.campaign.findUnique({ where: { slug } });
    if (!c) throw new NotFoundException();
    return { campaignName: c.name, dpoName: c.dpoName, dpoEmail: c.dpoEmail, dpoContact: c.dpoContact };
  }

  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'AUDITOR') @Get('privacy/consents')
  consents(@Query() q: any) { return this.audit.consents(q); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'AUDITOR') @Get('privacy/access-logs')
  logs(@Query() q: any) { return this.audit.accessLogs(q); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'AUDITOR') @Get('privacy/ropa')
  ropaJson() { return this.ropa.build(); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'AUDITOR') @Get('privacy/ropa.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8') @Header('Content-Disposition', 'attachment; filename="ropa.csv"')
  async ropaCsv() { return new StreamableFile(Buffer.from(await this.ropa.csv())); }

  @Roles('CANDIDATO', 'COORD_GERAL', 'AUDITOR') @Get('privacy/ropa.pdf')
  @Header('Content-Type', 'application/pdf') @Header('Content-Disposition', 'attachment; filename="ropa.pdf"')
  async ropaPdf() { return new StreamableFile(await this.ropa.pdf()); }

  @Roles('CANDIDATO', 'COORD_GERAL') @Get('privacy/retention-policy')
  policy() { return this.closer.getPolicy(); }

  @Roles('CANDIDATO', 'COORD_GERAL') @Put('privacy/retention-policy')
  setPolicy(@Body() dto: RetentionDto) { return this.closer.setPolicy(dto.policy); }

  @Roles('CANDIDATO', 'COORD_GERAL') @Post('privacy/close-campaign') @HttpCode(200)
  close(@Body() dto: CloseCampaignDto) { return this.closer.close(dto); }
}
