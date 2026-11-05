import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHash } from 'crypto';
import { ClsService } from 'nestjs-cls';
import { GeoRepository } from '../common/geo.repository';
import { PrismaService } from '../tenancy/prisma.service';
import { NominatimClient } from './nominatim.client';

export const GEOCODE_QUEUE = 'geocode';
export interface GeocodeJob { address: string; campaignId: string; supporterId?: string }
export interface GeocodeResult { status: 'OK' | 'FAILED'; lat?: number; lng?: number; cached?: boolean }

export const addressHash = (a: string) => createHash('sha256').update(a.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');

// RN-23: 1 requisição por segundo ao Nominatim (limiter do worker) + cache no banco.
@Processor(GEOCODE_QUEUE, { limiter: { max: 1, duration: 1000 } })
export class GeocodeProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService, private readonly client: NominatimClient,
    private readonly geo: GeoRepository, private readonly cls: ClsService,
  ) { super(); }

  async process(job: Job<GeocodeJob>): Promise<GeocodeResult> {
    const { address, campaignId, supporterId } = job.data;
    const queryHash = addressHash(address);
    let hit = await this.prisma.geocodeCache.findUnique({ where: { queryHash } });
    let cached = !!hit;
    if (!hit) {
      try {
        const found = await this.client.search(address);
        hit = await this.prisma.geocodeCache.create({ data: { queryHash, lat: found?.lat ?? null, lng: found?.lng ?? null } });
      } catch {
        await this.markFailed(supporterId, campaignId);
        return { status: 'FAILED' };
      }
    }
    if (hit.lat == null || hit.lng == null) {
      await this.markFailed(supporterId, campaignId);
      return { status: 'FAILED', cached };
    }
    if (!supporterId) return { status: 'OK', lat: hit.lat, lng: hit.lng, cached };
    const s = await this.prisma.supporter.findFirst({ where: { id: supporterId, campaignId }, select: { jitterSeed: true } });
    if (!s) return { status: 'FAILED', cached };
    await this.cls.run(async () => {
      this.cls.set('campaignId', campaignId);
      await this.geo.setSupporterLocation(supporterId, hit!.lat!, hit!.lng!, s.jitterSeed);
    });
    return { status: 'OK', cached };
  }

  private async markFailed(supporterId: string | undefined, campaignId: string) {
    if (supporterId) await this.prisma.supporter.updateMany({ where: { id: supporterId, campaignId, anonymizedAt: null }, data: { geocodeStatus: 'FAILED' } });
  }
}
