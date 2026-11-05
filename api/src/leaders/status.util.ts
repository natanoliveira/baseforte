import { LeaderStatus } from '@baseforte/shared';

const DAY = 86_400_000;

/** RN-10: ativo ≤14 dias, frio 15–45, inativo >45 (ou sem atividade). Override manual vence. */
export function computeStatus(lastActivityAt: Date | null, override: LeaderStatus | null, now = new Date()): LeaderStatus {
  if (override) return override;
  if (!lastActivityAt) return 'INATIVO';
  const days = Math.floor((now.getTime() - lastActivityAt.getTime()) / DAY);
  if (days <= 14) return 'ATIVO';
  if (days <= 45) return 'FRIO';
  return 'INATIVO';
}

/** Mesma regra em forma de filtro Prisma (para filtrar por status no banco). */
export function statusWhere(status: LeaderStatus, now = new Date()) {
  const ago = (d: number) => new Date(now.getTime() - d * DAY);
  const byActivity =
    status === 'ATIVO' ? { lastActivityAt: { gt: ago(15) } }
    : status === 'FRIO' ? { lastActivityAt: { gt: ago(46), lte: ago(15) } }
    : { OR: [{ lastActivityAt: null }, { lastActivityAt: { lte: ago(46) } }] };
  return { OR: [{ statusOverride: status }, { statusOverride: null, ...byActivity }] };
}
