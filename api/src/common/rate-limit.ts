import { applyDecorators, CanActivate, ExecutionContext, HttpException, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';

type Opts = { name: string; max: number; windowMs: number; byEmail?: boolean };
const KEY = 'rate-limit';
// ponytail: contador em memória por processo; com várias instâncias da API, trocar por Redis (INCR + EXPIRE)
const hits = new Map<string, { n: number; reset: number }>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const o = this.reflector.get<Opts>(KEY, ctx.getHandler());
    if (!o || process.env.RATE_LIMIT === 'off') return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const email = o.byEmail ? String(req.body?.email ?? '').toLowerCase() : '';
    const k = `${o.name}:${req.ip}:${email}`;
    const now = Date.now();
    if (hits.size > 10_000) for (const [key, v] of hits) if (v.reset <= now) hits.delete(key);
    const h = hits.get(k);
    if (!h || h.reset <= now) { hits.set(k, { n: 1, reset: now + o.windowMs }); return true; }
    if (++h.n <= o.max) return true;
    const retry = Math.ceil((h.reset - now) / 1000);
    ctx.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(retry));
    throw new HttpException({ code: 'RATE_LIMITED', message: `Muitas tentativas. Tente de novo em ${retry}s.` }, 429);
  }
}

export const RateLimit = (o: Opts) => applyDecorators(SetMetadata(KEY, o), UseGuards(RateLimitGuard));
