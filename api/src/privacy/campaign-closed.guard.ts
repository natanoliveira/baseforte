import { CanActivate, ConflictException, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { IS_PUBLIC } from '../common/public.decorator';
import { PrismaService } from '../tenancy/prisma.service';

/** Campanha encerrada = somente leitura (exceto logout). */
@Injectable()
export class CampaignClosedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly cls: ClsService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    if (req.method === 'GET' || req.method === 'HEAD' || req.path.endsWith('/auth/logout')) return true;
    const c = await this.prisma.campaign.findUnique({ where: { id: this.cls.get('campaignId') }, select: { closedAt: true } });
    if (c?.closedAt) throw new ConflictException({ code: 'CAMPAIGN_CLOSED', message: 'Campanha encerrada' });
    return true;
  }
}
