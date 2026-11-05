import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

const CONSENT = { channel: 'presencial', purpose: 'comunicacao-campanha', textVersion: 'v1', textAccepted: 'Autorizo contato sobre a campanha.' };

describe('direitos do titular por token (lacuna 3: acesso, correção, portabilidade)', () => {
  let app: INestApplication, token: string, id: string, prisma: PrismaService;
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
    const campaignId = (await prisma.campaign.create({ data: { slug: `tt-${stamp}`, name: 'TT' } })).id;
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    const nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } })).id;
    const u = await prisma.user.create({ data: { campaignId, email: `tt-${stamp}@exemplo.test`, name: 'tt', role: 'LIDERANCA', passwordHash: await argon2.hash('pw') } });
    const l = await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: nb, name: 'tt' } });
    const ck = (await api().post('/api/v1/auth/login').send({ email: `tt-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
    const s = (await api().post('/api/v1/supporters').set('Cookie', ck).send({ name: 'Titular', phone: '86999990000', address: 'Rua A, 1', neighborhoodId: nb, leaderId: l.id, consent: CONSENT }).expect(201)).body;
    id = s.id; token = s.removalUrl.split('/').pop();
  });
  afterAll(async () => { await app.close(); });

  it('acesso/portabilidade: devolve os dados decifrados sem login', async () => {
    const r = await api().get(`/api/v1/public/my-data/${token}`).expect(200);
    expect(r.body).toMatchObject({ name: 'Titular', phone: '86999990000', address: 'Rua A, 1' });
    expect(r.body.consents).toHaveLength(1);
    expect(r.body).not.toHaveProperty('id');
  });

  it('correção: altera nome/telefone/endereço e recalcula o hash do telefone', async () => {
    const r = await api().patch(`/api/v1/public/my-data/${token}`).send({ name: 'Titular Corrigido', phone: '86988887777' }).expect(200);
    expect(r.body).toMatchObject({ name: 'Titular Corrigido', phone: '86988887777', address: 'Rua A, 1' });
    const s = await prisma.supporter.findUnique({ where: { id } });
    expect(s?.phoneHash).toBeTruthy();
  });

  it('valida entrada e rejeita campo desconhecido', async () => {
    await api().patch(`/api/v1/public/my-data/${token}`).send({ name: 'x' }).expect(422);
    await api().patch(`/api/v1/public/my-data/${token}`).send({ leaderId: 'x' }).expect(422);
  });

  it('registra acesso e correção no log; token inválido → 404; após descadastro → 404', async () => {
    const acts = (await prisma.accessLog.findMany({ where: { resourceId: id } })).map((a) => a.action);
    expect(acts).toEqual(expect.arrayContaining(['TITULAR_ACCESS', 'TITULAR_CORRECT']));
    await api().get('/api/v1/public/my-data/00000000-0000-4000-8000-000000000000').expect(404);
    await api().post(`/api/v1/public/remove-data/${token}`).expect(200);
    await api().get(`/api/v1/public/my-data/${token}`).expect(404);
    await api().patch(`/api/v1/public/my-data/${token}`).send({ name: 'Zé' }).expect(404);
  });
});
