export interface AppConfig {
  databaseUrl: string;
  redisUrl: string;
  encKey: string;
  jwtSecret: string;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = ['DATABASE_URL', 'REDIS_URL', 'APP_ENC_KEY', 'JWT_SECRET'] as const;
  const missing = required.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  return {
    databaseUrl: env.DATABASE_URL!,
    redisUrl: env.REDIS_URL!,
    encKey: env.APP_ENC_KEY!,
    jwtSecret: env.JWT_SECRET!,
    port: Number(env.PORT ?? 3001),
  };
}
