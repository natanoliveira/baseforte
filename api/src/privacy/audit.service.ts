import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { parsePage, toPage } from '../common/pagination';
import { PrismaService } from '../tenancy/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService, private readonly cls: ClsService) {}

  async consents(q: { page?: string; pageSize?: string; active?: string }) {
    const { page, pageSize, skip, take } = parsePage(q);
    const where: Prisma.ConsentWhereInput = {
      ...(this.cls.get('role') === 'COORD_REGIAO' && { supporter: { neighborhood: { regionId: this.cls.get('regionId') ?? '' } } }),
      ...(q.active === 'true' && { revokedAt: null }),
      ...(q.active === 'false' && { revokedAt: { not: null } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.tenant.consent.findMany({
        where, orderBy: { grantedAt: 'desc' }, skip, take,
        select: { id: true, supporterId: true, grantedAt: true, channel: true, purpose: true, textVersion: true, collectedById: true, revokedAt: true, supporter: { select: { name: true } } },
      }),
      this.prisma.tenant.consent.count({ where }),
    ]);
    return toPage(rows.map(({ supporter, ...c }) => ({ ...c, supporterName: supporter.name })), total, page, pageSize);
  }

  async accessLogs(q: { page?: string; pageSize?: string; resource?: string; action?: string; outcome?: string }) {
    const { page, pageSize, skip, take } = parsePage(q);
    const where: Prisma.AccessLogWhereInput = {
      ...(q.resource && { resource: q.resource }), ...(q.action && { action: q.action }), ...(q.outcome && { outcome: q.outcome }),
    };
    const [data, total] = await Promise.all([
      this.prisma.tenant.accessLog.findMany({ where, orderBy: { at: 'desc' }, skip, take }),
      this.prisma.tenant.accessLog.count({ where }),
    ]);
    return toPage(data, total, page, pageSize);
  }
}
