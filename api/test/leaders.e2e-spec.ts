import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PLAN_LIMITS } from '@baseforte/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

describe('lideranças (RF-06/08, CA-05, CA-07)', () => {
  let app: INestApplication, prisma: PrismaService;
  let campaignId: string, nb: string, nbOther: string, cookies: string[], cregCookies: string[];
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());
  const body = (n: string, extra: any = {}) => ({ name: n, email: `${n}-${stamp}@exemplo.test`, password: 'senha1234', neighborhoodId: nb, ...extra });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `l-${stamp}`, name: 'Lead' } })).id;
    const r1 = await prisma.region.create({ data: { campaignId, name: 'R1' } });
    const r2 = await prisma.region.create({ data: { campaignId, name: 'R2' } });
    nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: r1.id, name: 'N1' } })).id;
    nbOther = (await prisma.neighborhood.create({ data: { campaignId, regionId: r2.id, name: 'N2' } })).id;
    const pw = await argon2.hash('pw');
    await prisma.user.create({ data: { campaignId, email: `cand-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    await prisma.user.create({ data: { campaignId, email: `creg-${stamp}@exemplo.test`, name: 'CR', role: 'COORD_REGIAO', regionId: r1.id, passwordHash: pw } });
    const login = async (k: string) => (await api().post('/api/v1/auth/login').send({ email: `${k}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
    cookies = await login('cand'); cregCookies = await login('creg');
  });
  afterAll(async () => {
    await prisma.leader.deleteMany({ where: { campaignId } });
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.neighborhood.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  it('cria liderança (com login), telefone cifrado e status calculado', async () => {
    const coord = await prisma.user.findFirstOrThrow({ where: { campaignId, role: 'COORD_REGIAO' } });
    const r = await api().post('/api/v1/leaders').set('Cookie', cookies).send(body('ana', { coordinatorId: coord.id, phone: '(86) 90000-0000', goal: 50 })).expect(201);
    expect(r.body).toMatchObject({ name: 'ana', goal: 50, status: 'INATIVO', supporterCount: 0 });
    const d = await api().get(`/api/v1/leaders/${r.body.id}`).set('Cookie', cookies).expect(200);
    expect(d.body.phone).toBe('(86) 90000-0000');
    const raw = await prisma.leader.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(Buffer.from(raw.phoneEnc!).toString('latin1')).not.toContain('90000');
  });

  it('override manual e filtro por status', async () => {
    const coord = await prisma.user.findFirstOrThrow({ where: { campaignId, role: 'COORD_REGIAO' } });
    const r = await api().post('/api/v1/leaders').set('Cookie', cookies).send(body('bia', { coordinatorId: coord.id })).expect(201);
    await api().patch(`/api/v1/leaders/${r.body.id}`).set('Cookie', cookies).send({ statusOverride: 'ATIVO' }).expect(200);
    const ativos = await api().get('/api/v1/leaders?status=ATIVO').set('Cookie', cookies).expect(200);
    expect(ativos.body.data.map((l: any) => l.name)).toEqual(['bia']);
    const cleared = await api().patch(`/api/v1/leaders/${r.body.id}`).set('Cookie', cookies).send({ statusOverride: null }).expect(200);
    expect(cleared.body.status).toBe('INATIVO');
  });

  it('exige parentId ou coordinatorId; coord de região só cria na sua região', async () => {
    await api().post('/api/v1/leaders').set('Cookie', cookies).send(body('sem-pai')).expect(422);
    await api().post('/api/v1/leaders').set('Cookie', cregCookies).send(body('fora', { neighborhoodId: nbOther })).expect(422);
    await api().post('/api/v1/leaders').set('Cookie', cregCookies).send(body('dentro')).expect(201);
  });

  it('CA-05: a 101ª liderança → 403 PLAN_LIMIT_REACHED', async () => {
    const have = await prisma.leader.count({ where: { campaignId } });
    const pw = await argon2.hash('x');
    for (let i = 0; i < PLAN_LIMITS.VEREADOR.leaders - have; i++) {
      const u = await prisma.user.create({ data: { campaignId, email: `f${i}-${stamp}@exemplo.test`, name: 'F', role: 'LIDERANCA', passwordHash: pw } });
      await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: nb, name: `f${i}` } });
    }
    const coord = await prisma.user.findFirstOrThrow({ where: { campaignId, role: 'COORD_REGIAO' } });
    const r = await api().post('/api/v1/leaders').set('Cookie', cookies).send(body('extra', { coordinatorId: coord.id })).expect(403);
    expect(r.body.code).toBe('PLAN_LIMIT_REACHED');
  }, 60000);
});
