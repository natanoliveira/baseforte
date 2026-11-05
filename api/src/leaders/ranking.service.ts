import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';

/** RN-11: 60% meta atingida (teto 1) + 40% atividade 30d normalizada pelo máximo da campanha. */
export function rankScore(supporters: number, goal: number, activity: number, maxActivity: number) {
  const meta = goal > 0 ? Math.min(1, supporters / goal) : 0;
  const act = maxActivity > 0 ? activity / maxActivity : 0;
  return Math.round((0.6 * meta + 0.4 * act) * 10000) / 10000;
}

@Injectable()
export class RankingService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService, private readonly cls: ClsService) {}

  async ranking() {
    const campaignId = this.cls.get('campaignId');
    const ids = (await this.prisma.tenant.leader.findMany({ where: await this.scope.leaderWhere(), select: { id: true } })).map((l) => l.id);
    if (!ids.length) return [];
    // Apoiadores contam para a meta só com consentimento ativo (OQ-02); a normalização usa a campanha toda.
    const rows = await this.prisma.$queryRaw<{ id: string; name: string; goal: number; supporters: bigint; activity: bigint }[]>(Prisma.sql`
      SELECT l.id, l.name, l.goal,
             COUNT(DISTINCT s.id) FILTER (WHERE c.id IS NOT NULL) AS supporters,
             COUNT(DISTINCT s.id) FILTER (WHERE c.id IS NOT NULL AND s."createdAt" >= now() - interval '30 days') AS activity
      FROM "Leader" l
      LEFT JOIN "Supporter" s ON s."leaderId" = l.id AND s."anonymizedAt" IS NULL
      LEFT JOIN "Consent" c ON c."supporterId" = s.id AND c."revokedAt" IS NULL
      WHERE l."campaignId" = ${campaignId}
      GROUP BY l.id`);
    const maxActivity = Math.max(0, ...rows.map((r) => Number(r.activity)));
    const inScope = new Set(ids);
    return rows
      .filter((r) => inScope.has(r.id))
      .map((r) => {
        const supporters = Number(r.supporters), activity = Number(r.activity);
        return {
          id: r.id, name: r.name, goal: r.goal, supporters, activity30d: activity,
          goalPct: r.goal > 0 ? Math.round((supporters / r.goal) * 100) : null,
          score: rankScore(supporters, r.goal, activity, maxActivity),
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((r, i) => ({ rank: i + 1, ...r }));
  }
}
