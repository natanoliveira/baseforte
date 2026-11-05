import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { PrismaService } from '../tenancy/prisma.service';

export const REMOVED_NAME = 'Cadastro removido';

@Injectable()
export class RemovalService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(supporterId: string) {
    return createHmac('sha256', process.env.APP_ENC_KEY as string).update(supporterId).digest('hex');
  }

  /**
   * Descadastro (RN-18): revoga consentimentos, anonimiza PII e guarda só um registro mínimo (hash).
   * Idempotente (CB-04): repetir não gera novo log nem novo registro.
   * Usa o client sem extension: o campaignId vem do próprio apoiador (rota pública) ou do escopo já validado.
   */
  async remove(supporterId: string, campaignId: string, actor: { userId: string | null; role: any }, reason: string) {
    const s = await this.prisma.supporter.findFirst({ where: { id: supporterId, campaignId }, select: { id: true, anonymizedAt: true } });
    if (!s) throw new NotFoundException();
    if (s.anonymizedAt) return { removed: true, alreadyRemoved: true };
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.consent.updateMany({ where: { supporterId, campaignId, revokedAt: null }, data: { revokedAt: now } });
      await tx.supporter.update({
        where: { id: supporterId },
        data: { name: REMOVED_NAME, phoneEnc: null, phoneHash: null, cpfEnc: null, addressEnc: null, locationEnc: null, anonymizedAt: now },
      });
      await tx.$executeRaw(Prisma.sql`UPDATE "Supporter" SET "mapPoint" = NULL WHERE id = ${supporterId} AND "campaignId" = ${campaignId}`);
      await tx.removalRecord.create({ data: { campaignId, supporterHash: this.hash(supporterId), reason } });
      await tx.accessLog.create({
        data: { campaignId, userId: actor.userId, role: actor.role, resource: 'supporter', resourceId: supporterId, action: 'REMOVE', outcome: 'OK' },
      });
    });
    return { removed: true, alreadyRemoved: false };
  }

  /** Rota pública: token único por apoiador. */
  async removeByToken(token: string) {
    const s = await this.prisma.supporter.findUnique({ where: { removalToken: token }, select: { id: true, campaignId: true } });
    if (!s) throw new NotFoundException();
    return this.remove(s.id, s.campaignId, { userId: null, role: null }, 'solicitado pelo titular');
  }

  async tokenInfo(token: string) {
    const s = await this.prisma.supporter.findUnique({ where: { removalToken: token }, select: { anonymizedAt: true, campaign: { select: { name: true, slug: true } } } });
    if (!s) throw new NotFoundException();
    return { campaignName: s.campaign.name, campaignSlug: s.campaign.slug, alreadyRemoved: !!s.anonymizedAt };
  }
}
