import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsIn, IsString } from 'class-validator';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../tenancy/prisma.service';

export class CloseCampaignDto {
  @IsBoolean() confirm1!: boolean;
  @IsString() confirm2!: string;
}

export class RetentionDto {
  @IsIn(['ANONIMIZAR', 'APAGAR']) policy!: 'ANONIMIZAR' | 'APAGAR';
}

@Injectable()
export class CloseCampaignService {
  constructor(private readonly prisma: PrismaService, private readonly cls: ClsService) {}

  async getPolicy() {
    const c = await this.prisma.campaign.findUniqueOrThrow({ where: { id: this.cls.get('campaignId') } });
    return { policy: c.retentionPolicy, closedAt: c.closedAt };
  }

  async setPolicy(policy: 'ANONIMIZAR' | 'APAGAR') {
    await this.assertOpen();
    await this.prisma.campaign.update({ where: { id: this.cls.get('campaignId') }, data: { retentionPolicy: policy } });
    return this.getPolicy();
  }

  async assertOpen() {
    const c = await this.prisma.campaign.findUniqueOrThrow({ where: { id: this.cls.get('campaignId') }, select: { closedAt: true } });
    if (c.closedAt) throw new ConflictException({ code: 'CAMPAIGN_CLOSED', message: 'Campanha encerrada' });
  }

  /** RN-19: confirmação dupla; aplica a política a TODOS os apoiadores (CB-08); irreversível. */
  async close(dto: CloseCampaignDto) {
    const campaignId = this.cls.get('campaignId');
    await this.assertOpen();
    const c = await this.prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    if (dto.confirm1 !== true || dto.confirm2.trim() !== c.name) {
      throw new UnprocessableEntityException({ code: 'CONFIRMATION_REQUIRED', message: 'Confirme as duas etapas: marque a opção e digite o nome da campanha' });
    }
    const key = process.env.APP_ENC_KEY as string;
    const now = new Date();
    const affected = await this.prisma.$transaction(async (tx) => {
      // Registro mínimo de prova antes de anonimizar/apagar.
      const n = await tx.$executeRaw(Prisma.sql`
        INSERT INTO "RemovalRecord" (id, "campaignId", "supporterHash", reason, at)
        SELECT gen_random_uuid(), "campaignId", encode(hmac(id::text, ${key}, 'sha256'), 'hex'), 'encerramento da campanha', ${now}
        FROM "Supporter" WHERE "campaignId" = ${campaignId} AND "anonymizedAt" IS NULL`);
      if (c.retentionPolicy === 'APAGAR') {
        await tx.consent.deleteMany({ where: { campaignId } });
        await tx.supporter.deleteMany({ where: { campaignId } });
      } else {
        await tx.consent.updateMany({ where: { campaignId, revokedAt: null }, data: { revokedAt: now } });
        await tx.$executeRaw(Prisma.sql`
          UPDATE "Supporter" SET name = 'Cadastro removido', "phoneEnc" = NULL, "phoneHash" = NULL, "cpfEnc" = NULL,
                 "addressEnc" = NULL, "locationEnc" = NULL, "mapPoint" = NULL, "anonymizedAt" = ${now}
          WHERE "campaignId" = ${campaignId} AND "anonymizedAt" IS NULL`);
      }
      await tx.campaign.update({ where: { id: campaignId }, data: { closedAt: now } });
      await tx.accessLog.create({
        data: { campaignId, userId: this.cls.get('userId'), role: this.cls.get('role'), resource: 'campaign', resourceId: campaignId, action: 'CLOSE_CAMPAIGN', outcome: 'OK' },
      });
      return n;
    });
    return { closedAt: now, policy: c.retentionPolicy, supporters: Number(affected) };
  }
}
