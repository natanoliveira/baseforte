import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PLAN_LIMITS } from '@baseforte/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

describe('usuários + limite de plano (CA-05)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let campaignId: string;
  let cookies: string[];
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `u-${stamp}`, name: 'Users' } })).id;
    const passwordHash = await argon2.hash('senha1234');
    await prisma.user.create({ data: { campaignId, email: `c-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash } });
    await prisma.user.create({ data: { campaignId, email: `a-${stamp}@exemplo.test`, name: 'A', role: 'AUDITOR', passwordHash } });
    cookies = (await api().post('/api/v1/auth/login').send({ email: `c-${stamp}@exemplo.test`, password: 'senha1234' })).headers['set-cookie'] as unknown as string[];
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  it('cria usuário, não vaza hash e rejeita e-mail duplicado e CANDIDATO', async () => {
    const body = { email: `g-${stamp}@exemplo.test`, name: 'Geral', password: 'senha1234', role: 'COORD_GERAL' };
    const r = await api().post('/api/v1/users').set('Cookie', cookies).send(body).expect(201);
    expect(r.body.passwordHash).toBeUndefined();
    await api().post('/api/v1/users').set('Cookie', cookies).send(body).expect(409);
    await api().post('/api/v1/users').set('Cookie', cookies).send({ ...body, email: `x-${stamp}@exemplo.test`, role: 'CANDIDATO' }).expect(422);
  });

  it('coord de região exige região', () =>
    api().post('/api/v1/users').set('Cookie', cookies)
      .send({ email: `cr-${stamp}@exemplo.test`, name: 'CR', password: 'senha1234', role: 'COORD_REGIAO' }).expect(422));

  it('auditor não acessa /users (403)', async () => {
    const a = (await api().post('/api/v1/auth/login').send({ email: `a-${stamp}@exemplo.test`, password: 'senha1234' })).headers['set-cookie'] as unknown as string[];
    await api().get('/api/v1/users').set('Cookie', a).expect(403);
  });

  it('estourar o limite do plano → 403 PLAN_LIMIT_REACHED', async () => {
    const have = await prisma.user.count({ where: { campaignId } });
    const passwordHash = await argon2.hash('x');
    await prisma.user.createMany({
      data: Array.from({ length: PLAN_LIMITS.VEREADOR.users - have }, (_, i) => ({ campaignId, email: `f${i}-${stamp}@exemplo.test`, name: 'F', role: 'AUDITOR' as const, passwordHash })),
    });
    const r = await api().post('/api/v1/users').set('Cookie', cookies)
      .send({ email: `over-${stamp}@exemplo.test`, name: 'Over', password: 'senha1234', role: 'AUDITOR' }).expect(403);
    expect(r.body.code).toBe('PLAN_LIMIT_REACHED');
  });
});
