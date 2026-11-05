import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../tenancy/prisma.service';

@Injectable()
export class AccessLogService {
  constructor(private readonly prisma: PrismaService, private readonly cls: ClsService) {}

  log(resource: string, resourceId: string | null, action: string, outcome: 'OK' | 'DENIED' = 'OK') {
    return this.prisma.tenant.accessLog.create({
      data: { userId: this.cls.get('userId'), role: this.cls.get('role'), resource, resourceId, action, outcome } as any,
    });
  }
}
