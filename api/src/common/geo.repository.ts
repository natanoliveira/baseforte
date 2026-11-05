import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../tenancy/prisma.service';
import { jitterPoint } from './jitter';
import { SensitiveDataService } from './sensitive-data.service';

/** Todo SQL espacial passa por aqui; sempre filtra por campaignId (raw não passa pela extension). */
@Injectable()
export class GeoRepository {
  constructor(private readonly prisma: PrismaService, private readonly sensitive: SensitiveDataService, private readonly cls: ClsService) {}

  /** Guarda coordenada exata cifrada e o ponto de mapa já com jitter (o mapa nunca toca o exato). */
  async setSupporterLocation(supporterId: string, lat: number, lng: number, jitterSeed: number) {
    const enc = await this.sensitive.encrypt(JSON.stringify({ lat, lng }));
    const j = jitterPoint(lat, lng, jitterSeed);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Supporter"
      SET "locationEnc" = ${enc}, "mapPoint" = ST_SetSRID(ST_MakePoint(${j.lng}, ${j.lat}), 4326), "geocodeStatus" = 'OK'
      WHERE id = ${supporterId} AND "campaignId" = ${this.cls.get('campaignId')}`);
  }

  /** Bairro que contém o ponto (ou null). */
  async neighborhoodAt(lat: number, lng: number): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "Neighborhood"
      WHERE "campaignId" = ${this.cls.get('campaignId')} AND ST_Contains(geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
      LIMIT 1`);
    return rows[0]?.id ?? null;
  }
}
