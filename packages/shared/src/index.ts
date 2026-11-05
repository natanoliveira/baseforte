export const Role = {
  CANDIDATO: 'CANDIDATO',
  COORD_GERAL: 'COORD_GERAL',
  COORD_REGIAO: 'COORD_REGIAO',
  LIDERANCA: 'LIDERANCA',
  AUDITOR: 'AUDITOR',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Plan = { VEREADOR: 'VEREADOR', PREFEITO: 'PREFEITO' } as const;
export type Plan = (typeof Plan)[keyof typeof Plan];

export const LeaderStatus = { ATIVO: 'ATIVO', FRIO: 'FRIO', INATIVO: 'INATIVO' } as const;
export type LeaderStatus = (typeof LeaderStatus)[keyof typeof LeaderStatus];

export const PLAN_LIMITS: Record<Plan, { users: number; leaders: number }> = {
  VEREADOR: { users: 60, leaders: 100 },
  PREFEITO: { users: 300, leaders: 1000 },
};
