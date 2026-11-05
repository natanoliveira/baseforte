import { loadConfig } from './config';

describe('loadConfig', () => {
  it('falha sem APP_ENC_KEY', () => {
    expect(() => loadConfig({ DATABASE_URL: 'x', REDIS_URL: 'x', JWT_SECRET: 'x' } as any)).toThrow(/APP_ENC_KEY/);
  });
  it('carrega com tudo definido', () => {
    const c = loadConfig({ DATABASE_URL: 'd', REDIS_URL: 'r', APP_ENC_KEY: 'k', JWT_SECRET: 's' } as any);
    expect(c.port).toBe(3001);
  });
});
