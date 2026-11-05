import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService, private readonly cls: ClsService) {}

  async listRegions() {
    const role = this.cls.get('role');
    const where = role === 'COORD_REGIAO' ? { id: this.cls.get('regionId') ?? '' } : {};
    return this.prisma.tenant.region.findMany({ where, orderBy: { name: 'asc' } });
  }

  /** Bairros no escopo do papel, com geometria/centróide em GeoJSON. */
  async listNeighborhoods() {
    const rows = await this.prisma.tenant.neighborhood.findMany({
      where: await this.scope.neighborhoodWhere(),
      select: { id: true },
    });
    if (!rows.length) return [];
    return this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT id, "regionId", name,
             ST_AsGeoJSON(geom)::json AS geometry,
             ST_AsGeoJSON(centroid)::json AS centroid
      FROM "Neighborhood"
      WHERE "campaignId" = ${this.cls.get('campaignId')} AND id IN (${Prisma.join(rows.map((r) => r.id))})
      ORDER BY name`);
  }

  async moveNeighborhood(id: string, regionId: string) {
    const [n, r] = await Promise.all([
      this.prisma.tenant.neighborhood.findFirst({ where: { id }, select: { id: true } }),
      this.prisma.tenant.region.findFirst({ where: { id: regionId }, select: { id: true } }),
    ]);
    if (!n || !r) throw new NotFoundException();
    return this.prisma.tenant.neighborhood.update({ where: { id }, data: { regionId }, select: { id: true, regionId: true, name: true } });
  }
}
