import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { IS_PUBLIC } from '../common/public.decorator';
import { TenantUser } from './tenant-context';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly cls: ClsService, private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const user: TenantUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user?.campaignId) throw new UnauthorizedException();
    this.cls.set('campaignId', user.campaignId);
    this.cls.set('userId', user.sub);
    this.cls.set('role', user.role);
    this.cls.set('regionId', user.regionId ?? null);
    this.cls.set('leaderId', user.leaderId ?? null);
    return true;
  }
}
