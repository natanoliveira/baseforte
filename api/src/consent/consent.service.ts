import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { SensitiveDataService } from '../common/sensitive-data.service';
import { parsePage, toPage } from '../common/pagination';
import { ConsentInputDto } from '../supporters/supporters.dto';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';

/** Consentimento ativo = não revogado e cadastro não anonimizado (RN-17). */
export const activeConsent: Prisma.SupporterWhereInput = {
  anonymizedAt: null,
  consents: { some: { revokedAt: null } },
};

export function waUrl(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, '');
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService, private readonly scope: ScopeService,
    private readonly cls: ClsService, private readonly sens: SensitiveDataService,
  ) {}

  private async supporterInScope(id: string, extra: Prisma.SupporterWhereInput = {}) {
    const s = await this.prisma.tenant.supporter.findFirst({
      where: { AND: [await this.scope.supporterWhere(), { id }, extra] },
      select: { id: true, phoneEnc: true },
    });
    if (!s) throw new NotFoundException();
    return s;
  }

  async grant(supporterId: string, dto: ConsentInputDto) {
    const s = await this.prisma.tenant.supporter.findFirst({
      where: { AND: [await this.scope.supporterWhere(), { id: supporterId }] },
      select: { id: true, anonymizedAt: true },
    });
    if (!s) throw new NotFoundException();
    if (s.anonymizedAt) throw new ConflictException('Cadastro anonimizado');
    const c = await this.prisma.tenant.consent.create({
      data: { supporterId, ...dto, collectedById: this.cls.get('userId') } as any,
      select: { id: true, grantedAt: true, channel: true, purpose: true, textVersion: true },
    });
    return c;
  }

  /** Lista de comunicação: só apoiadores com consentimento ativo, sem PII. */
  async communicationList(q: { page?: string; pageSize?: string; neighborhoodId?: string; leaderId?: string; purpose?: string }) {
    const { page, pageSize, skip, take } = parsePage(q);
    const where: Prisma.SupporterWhereInput = {
      AND: [
        await this.scope.supporterWhere(),
        q.purpose ? { anonymizedAt: null, consents: { some: { revokedAt: null, purpose: q.purpose } } } : activeConsent,
        ...(q.neighborhoodId ? [{ neighborhoodId: q.neighborhoodId }] : []),
        ...(q.leaderId ? [{ leaderId: q.leaderId }] : []),
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.tenant.supporter.findMany({ where, orderBy: { name: 'asc' }, skip, take, select: { id: true, name: true, leaderId: true, neighborhoodId: true, phoneEnc: true } }),
      this.prisma.tenant.supporter.count({ where }),
    ]);
    return toPage(rows.map(({ phoneEnc, ...r }) => ({ ...r, hasPhone: !!phoneEnc })), total, page, pageSize);
  }

  /** Link wa.me individual; o usuário envia manualmente (RN-20). */
  async waLink(supporterId: string, text?: string) {
    const s = await this.supporterInScope(supporterId);
    const withConsent = await this.prisma.tenant.supporter.count({ where: { AND: [{ id: supporterId }, activeConsent] } });
    if (!withConsent) throw new UnprocessableEntityException({ code: 'CONSENT_REQUIRED', message: 'Sem consentimento ativo' });
    const phone = await this.sens.decrypt(s.phoneEnc);
    if (!phone) throw new UnprocessableEntityException('Apoiador sem telefone');
    return { url: waUrl(phone, text) };
  }
}
