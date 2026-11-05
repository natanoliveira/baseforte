import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { jitterPoint } from '../common/jitter';
import { activeConsent } from '../consent/consent.service';
import { statusWhere, computeStatus } from '../leaders/status.util';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';

export interface MapFilters { coordinatorId?: string; neighborhoodId?: string; status?: 'ATIVO' | 'FRIO' | 'INATIVO'; goalMin?: number; goalMax?: number; leaderId?: string }

const fc = (features: any[]) => ({ type: 'FeatureCollection', features });
const point = (lng: number, lat: number, properties: any = {}) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lng, lat] } });

/**
 * Mapa (RN-14): lê SOMENTE `mapPoint` (já deslocado) e centróides. Nunca toca `locationEnc`,
 * então coordenada exata não consegue sair por aqui.
 */
@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService, private readonly cls: ClsService) {}

  private async supporterSql(): Promise<Prisma.Sql> {
    const role = this.cls.get('role'), cid = this.cls.get('campaignId');
    if (role === 'CANDIDATO' || role === 'COORD_GERAL') return Prisma.sql`TRUE`;
    if (role === 'COORD_REGIAO') {
      return Prisma.sql`s."neighborhoodId" IN (SELECT id FROM "Neighborhood" WHERE "campaignId" = ${cid} AND "regionId" = ${this.cls.get('regionId') ?? ''})`;
    }
    if (role === 'LIDERANCA') {
      const own = this.cls.get('leaderId');
      const ids = own ? await this.scope.subtreeIds(own) : [];
      return ids.length ? Prisma.sql`s."leaderId" IN (${Prisma.join(ids)})` : Prisma.sql`FALSE`;
    }
    throw new ForbiddenException();
  }

  private async centroids(ids?: string[]) {
    const rows = await this.prisma.$queryRaw<{ id: string; lng: number; lat: number }[]>(Prisma.sql`
      SELECT id, ST_X(centroid) lng, ST_Y(centroid) lat FROM "Neighborhood"
      WHERE "campaignId" = ${this.cls.get('campaignId')} AND centroid IS NOT NULL ${ids?.length ? Prisma.sql`AND id IN (${Prisma.join(ids)})` : Prisma.empty}`);
    return new Map(rows.map((r) => [r.id, r]));
  }

  private async supporterCounts(extra: Prisma.SupporterWhereInput = {}) {
    const g = await this.prisma.tenant.supporter.groupBy({
      by: ['leaderId'], _count: { _all: true },
      where: { AND: [await this.scope.supporterWhere(), activeConsent, extra] },
    });
    return new Map(g.map((x) => [x.leaderId, x._count._all]));
  }

  /** Pins por liderança: posição = centróide do bairro + deslocamento estável (evita sobreposição). */
  async leaders(f: MapFilters) {
    const where: Prisma.LeaderWhereInput = {
      AND: [
        await this.scope.leaderWhere(),
        ...(f.coordinatorId ? [{ OR: [{ coordinatorId: f.coordinatorId }, { neighborhood: { region: { users: { some: { id: f.coordinatorId } } } } }] }] : []),
        ...(f.neighborhoodId ? [{ neighborhoodId: f.neighborhoodId }] : []),
        ...(f.status ? [statusWhere(f.status)] : []),
        ...((f.goalMin != null || f.goalMax != null) ? [{ goal: { gte: f.goalMin, lte: f.goalMax } }] : []),
      ],
    };
    const [leaders, counts, cents] = await Promise.all([
      this.prisma.tenant.leader.findMany({ where }), this.supporterCounts(), this.centroids(),
    ]);
    return fc(leaders.flatMap((l) => {
      const c = cents.get(l.neighborhoodId);
      if (!c) return [];
      const seed = parseInt(l.id.slice(0, 8), 16);
      const p = jitterPoint(c.lat, c.lng, seed, 600, 80);
      const n = counts.get(l.id) ?? 0;
      return [point(p.lng, p.lat, {
        id: l.id, name: l.name, status: computeStatus(l.lastActivityAt, l.statusOverride), supporters: n, goal: l.goal,
        goalPct: l.goal > 0 ? Math.round((n / l.goal) * 100) : null, neighborhoodId: l.neighborhoodId,
      })];
    }));
  }

  /** Mapa de calor: só coordenadas deslocadas, sem id nem nome. */
  async heatmap(f: Pick<MapFilters, 'neighborhoodId' | 'leaderId'>) {
    const rows = await this.prisma.$queryRaw<{ lng: number; lat: number }[]>(Prisma.sql`
      SELECT ST_X(s."mapPoint") lng, ST_Y(s."mapPoint") lat FROM "Supporter" s
      WHERE s."campaignId" = ${this.cls.get('campaignId')} AND s."anonymizedAt" IS NULL AND s."mapPoint" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "Consent" c WHERE c."supporterId" = s.id AND c."revokedAt" IS NULL)
        AND ${await this.supporterSql()}
        ${f.neighborhoodId ? Prisma.sql`AND s."neighborhoodId" = ${f.neighborhoodId}` : Prisma.empty}
        ${f.leaderId ? Prisma.sql`AND s."leaderId" = ${f.leaderId}` : Prisma.empty}
      LIMIT 20000`);
    return fc(rows.map((r) => point(r.lng, r.lat)));
  }

  private async polygons(ids: string[]) {
    if (!ids.length) return [];
    return this.prisma.$queryRaw<{ id: string; name: string; geometry: any }[]>(Prisma.sql`
      SELECT id, name, ST_AsGeoJSON(geom)::json geometry FROM "Neighborhood"
      WHERE "campaignId" = ${this.cls.get('campaignId')} AND geom IS NOT NULL AND id IN (${Prisma.join(ids)})`);
  }

  private async totals(): Promise<Map<string, { goal: number; supporters: number; leaders: number }>> {
    const [leaders, sup] = await Promise.all([
      this.prisma.tenant.leader.findMany({ where: await this.scope.leaderWhere(), select: { id: true, goal: true, neighborhoodId: true } }),
      this.prisma.tenant.supporter.groupBy({ by: ['neighborhoodId'], _count: { _all: true }, where: { AND: [await this.scope.supporterWhere(), activeConsent] } }),
    ]);
    const m = new Map<string, { goal: number; supporters: number; leaders: number }>();
    const get = (id: string) => m.get(id) ?? m.set(id, { goal: 0, supporters: 0, leaders: 0 }).get(id)!;
    for (const l of leaders) { const t = get(l.neighborhoodId); t.goal += l.goal; t.leaders++; }
    for (const s of sup) get(s.neighborhoodId).supporters = s._count._all;
    return m;
  }

  /** Coroplético: % da meta por bairro. Meta 0 → pct null (CB-03). Contagens respeitam o escopo do papel. */
  async choropleth() {
    const ids = (await this.prisma.tenant.neighborhood.findMany({ where: await this.scope.neighborhoodWhere(), select: { id: true } })).map((n) => n.id);
    const [polys, totals] = await Promise.all([this.polygons(ids), this.totals()]);
    return fc(polys.map((p) => {
      const t = totals.get(p.id) ?? { goal: 0, supporters: 0, leaders: 0 };
      return { type: 'Feature', geometry: p.geometry, properties: { id: p.id, name: p.name, goal: t.goal, supporters: t.supporters, pct: t.goal > 0 ? Math.round((t.supporters / t.goal) * 100) : null } };
    }));
  }

  /** "Vazios": bairros sem nenhuma liderança na campanha (fato agregado, sem dado pessoal). */
  async gaps() {
    const ns = await this.prisma.tenant.neighborhood.findMany({ where: await this.scope.neighborhoodWhere(), select: { id: true } });
    const withLeader = new Set((await this.prisma.tenant.leader.findMany({ select: { neighborhoodId: true }, distinct: ['neighborhoodId'] })).map((l) => l.neighborhoodId));
    const polys = await this.polygons(ns.map((n) => n.id).filter((id) => !withLeader.has(id)));
    return fc(polys.map((p) => ({ type: 'Feature', geometry: p.geometry, properties: { id: p.id, name: p.name, gap: true } })));
  }

  async votingPlaces() {
    const rows = await this.prisma.$queryRaw<{ id: string; name: string; lng: number; lat: number; neighborhoodId: string }[]>(Prisma.sql`
      SELECT id, name, "neighborhoodId", ST_X(location) lng, ST_Y(location) lat FROM "VotingPlace"
      WHERE "campaignId" = ${this.cls.get('campaignId')} AND location IS NOT NULL`);
    return fc(rows.map((r) => point(r.lng, r.lat, { id: r.id, name: r.name, neighborhoodId: r.neighborhoodId })));
  }

  async panel(neighborhoodId: string) {
    const n = await this.prisma.tenant.neighborhood.findFirst({ where: { AND: [await this.scope.neighborhoodWhere(), { id: neighborhoodId }] }, select: { id: true, name: true, regionId: true } });
    if (!n) throw new NotFoundException();
    const [leaders, counts, places, anyLeader] = await Promise.all([
      this.prisma.tenant.leader.findMany({ where: { AND: [await this.scope.leaderWhere(), { neighborhoodId }] }, orderBy: { name: 'asc' } }),
      this.supporterCounts({ neighborhoodId }),
      this.prisma.tenant.votingPlace.findMany({ where: { neighborhoodId }, select: { id: true, name: true } }),
      this.prisma.tenant.leader.count({ where: { neighborhoodId } }),
    ]);
    const rows = leaders.map((l) => ({ id: l.id, name: l.name, status: computeStatus(l.lastActivityAt, l.statusOverride), goal: l.goal, supporters: counts.get(l.id) ?? 0 }));
    const goal = rows.reduce((a, r) => a + r.goal, 0), supporters = rows.reduce((a, r) => a + r.supporters, 0);
    return {
      neighborhood: n, leaders: rows, supporters, goal, pct: goal > 0 ? Math.round((supporters / goal) * 100) : null,
      requests: [], // demandas entram na F2
      gaps: { noLeaders: anyLeader === 0, belowGoal: goal > 0 && supporters < goal },
      votingPlaces: places,
    };
  }
}
