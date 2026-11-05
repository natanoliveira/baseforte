import { ForbiddenException, Injectable } from '@nestjs/common';
import { PLAN_LIMITS } from '@baseforte/shared';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../tenancy/prisma.service';

@Injectable()
export class PlanLimitService {
  constructor(private readonly prisma: PrismaService, private readonly cls: ClsService) {}

  private async plan() {
    const c = await this.prisma.campaign.findUniqueOrThrow({ where: { id: this.cls.get('campaignId') } });
    return PLAN_LIMITS[c.plan];
  }

  private full(what: string, limit: number): never {
    throw new ForbiddenException({ code: 'PLAN_LIMIT_REACHED', message: `Limite do plano atingido: ${limit} ${what}` });
  }

  async assertCanCreateUser() {
    const { users } = await this.plan();
    if ((await this.prisma.tenant.user.count({ where: { role: { not: 'LIDERANCA' } } })) >= users) this.full('usuários', users);
  }

  async assertCanCreateLeader() {
    const { leaders } = await this.plan();
    if ((await this.prisma.tenant.leader.count()) >= leaders) this.full('lideranças', leaders);
  }
}
