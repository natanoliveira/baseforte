import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { tenantExtension } from './tenant.extension';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Cliente isolado por campanha (padrão para todo código de domínio). */
  readonly tenant;

  constructor(private readonly cls: ClsService) {
    super();
    this.tenant = this.$extends(
      tenantExtension(() => {
        const id = this.cls.get('campaignId');
        if (!id) throw new Error('Contexto de tenant ausente');
        return id;
      }),
    );
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
