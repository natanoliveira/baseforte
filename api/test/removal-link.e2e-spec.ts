import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

const CONSENT = { channel: 'presencial', purpose: 'comunicacao-campanha', textVersion: 'v1', textAccepted: 'Autorizo contato sobre a campanha.' };

describe('link de descadastro e rate limit (RF-22, lacunas 1 e 2)', () => {
  let app: INestApplication, nb: string, la: string[], lb: string[], leaderA: string, sup: { id: string; removalUrl: string };
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    const prisma = mod.get(PrismaService);
    const campaignId = (await prisma.campaign.create({ data: { slug: `rl-${stamp}`, name: 'RL' } })).id;
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } })).id;
    const pw = await argon2.hash('pw');
    for (const k of ['la', 'lb']) {
      const u = await prisma.user.create({ data: { campaignId, email: `${k}-${stamp}@exemplo.test`, name: k, role: 'LIDERANCA', passwordHash: pw } });
      const l = await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: nb, name: k } });
      if (k === 'la') leaderA = l.id;
    }
    const login = async (k: string) => (await api().post('/api/v1/auth/login').send({ email: `${k}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
    la = await login('la'); lb = await login('lb');
    sup = (await api().post('/api/v1/supporters').set('Cookie', la).send({ name: 'Apoiador Link', neighborhoodId: nb, leaderId: leaderA, consent: CONSENT }).expect(201)).body;
  });
  afterAll(async () => { process.env.RATE_LIMIT = 'off'; await app.close(); });

  it('cadastro devolve a URL pública de descadastro', () => {
    expect(sup.removalUrl).toMatch(/\/remover-dados\/[0-9a-f-]{36}$/);
  });

  it('equipe no escopo obtém o link; fora do escopo → 404', async () => {
    const r = await api().get(`/api/v1/supporters/${sup.id}/removal-link`).set('Cookie', la).expect(200);
    expect(r.body.url).toBe(sup.removalUrl);
    await api().get(`/api/v1/supporters/${sup.id}/removal-link`).set('Cookie', lb).expect(404);
  });

  it('sem login → 401 no link', () => api().get(`/api/v1/supporters/${sup.id}/removal-link`).expect(401));

  describe('rate limit ligado', () => {
    beforeAll(() => { process.env.RATE_LIMIT = 'on'; });
    afterAll(() => { process.env.RATE_LIMIT = 'off'; });

    it('login: 6ª tentativa errada em 1 min → 429 RATE_LIMITED com Retry-After', async () => {
      const body = { email: `brute-${stamp}@exemplo.test`, password: 'x' };
      for (let i = 0; i < 5; i++) await api().post('/api/v1/auth/login').send(body).expect(401);
      const r = await api().post('/api/v1/auth/login').send(body).expect(429);
      expect(r.body.code).toBe('RATE_LIMITED');
      expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
      await api().post('/api/v1/auth/login').send({ ...body, email: `outro-${stamp}@exemplo.test` }).expect(401);
    });

    it('descadastro público: 11ª chamada em 1 min → 429', async () => {
      const token = sup.removalUrl.split('/').pop();
      for (let i = 0; i < 10; i++) await api().post(`/api/v1/public/remove-data/${token}`).expect(200);
      await api().post(`/api/v1/public/remove-data/${token}`).expect(429);
    });
  });
});
