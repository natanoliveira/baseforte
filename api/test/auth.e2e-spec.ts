import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

describe('auth (RF-03)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let campaignId: string;
  const email = `cand-${Date.now()}@exemplo.test`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `a-${Date.now()}`, name: 'Auth' } })).id;
    await prisma.user.create({ data: { campaignId, email, name: 'Cand', role: 'CANDIDATO', passwordHash: await argon2.hash('senha123') } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('rota privada sem token → 401', () => api().get('/api/v1/auth/me').expect(401));
  it('senha errada → 401', () => api().post('/api/v1/auth/login').send({ email, password: 'x' }).expect(401));

  it('login → me → refresh → logout invalida refresh', async () => {
    const login = await api().post('/api/v1/auth/login').send({ email, password: 'senha123' }).expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('access_token=') && /HttpOnly/i.test(c))).toBe(true);
    const me = await api().get('/api/v1/auth/me').set('Cookie', cookies).expect(200);
    expect(me.body).toMatchObject({ email, role: 'CANDIDATO', campaignId });
    const refreshed = await api().post('/api/v1/auth/refresh').set('Cookie', cookies).expect(200);
    const c2 = refreshed.headers['set-cookie'] as unknown as string[];
    await api().post('/api/v1/auth/logout').set('Cookie', c2).expect(200);
    await api().post('/api/v1/auth/refresh').set('Cookie', c2).expect(401);
  });
});
