import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor, NotFoundException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, from, mergeMap, throwError } from 'rxjs';
import { AccessLogService } from './access-log.service';

const KEY = 'access-log';
/** Registra leitura/escrita de dado pessoal (RN-16). Falhas 403/404 viram outcome DENIED. */
export const LogAccess = (resource: string, action = 'READ') => SetMetadata(KEY, { resource, action });

@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly logs: AccessLogService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const meta = this.reflector.get<{ resource: string; action: string }>(KEY, ctx.getHandler());
    if (!meta) return next.handle();
    const id: string | null = ctx.switchToHttp().getRequest().params?.id ?? null;
    return next.handle().pipe(
      mergeMap((v) => from(this.logs.log(meta.resource, id, meta.action, 'OK').then(() => v))),
      catchError((e) => {
        if (e instanceof ForbiddenException || e instanceof NotFoundException) {
          return from(this.logs.log(meta.resource, id, meta.action, 'DENIED').then(() => { throw e; }));
        }
        return throwError(() => e);
      }),
    );
  }
}
