import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';
import { GEOCODE_QUEUE, GeocodeJob } from './geocode.processor';

export class GeocodeDto {
  @IsString() @MinLength(5) address!: string;
  @IsOptional() @IsUUID() supporterId?: string;
}

@Injectable()
export class GeocodeService {
  constructor(
    @InjectQueue(GEOCODE_QUEUE) private readonly queue: Queue<GeocodeJob>,
    private readonly prisma: PrismaService, private readonly scope: ScopeService, private readonly cls: ClsService,
  ) {}

  async enqueue(dto: GeocodeDto) {
    if (dto.supporterId) {
      const ok = await this.prisma.tenant.supporter.findFirst({ where: { AND: [await this.scope.supporterWhere(), { id: dto.supporterId, anonymizedAt: null }] }, select: { id: true } });
      if (!ok) throw new NotFoundException();
    }
    const job = await this.queue.add('geocode', { address: dto.address, supporterId: dto.supporterId, campaignId: this.cls.get('campaignId') }, {
      attempts: 1, removeOnComplete: { age: 3600 }, removeOnFail: { age: 3600 },
    });
    return { jobId: job.id };
  }

  async status(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job || job.data.campaignId !== this.cls.get('campaignId')) throw new NotFoundException();
    const state = await job.getState();
    return { jobId, state, result: state === 'completed' ? job.returnvalue : undefined };
  }
}
