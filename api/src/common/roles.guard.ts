import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@baseforte/shared';
import { IS_PUBLIC } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

// Fail-closed: rota autenticada sem @Roles() é negada.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    const user = ctx.switchToHttp().getRequest().user;
    if (!roles?.includes(user?.role)) throw new ForbiddenException();
    return true;
  }
}
