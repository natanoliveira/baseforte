import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

const CONSENT = { channel: 'presencial', purpose: 'comunicacao-campanha', textVersion: 'v1', textAccepted: 'Autorizo contato sobre a campanha.' };

describe('apoiadores (RF-10, CA-02/04/11, CB-05/10)', () => {
  let app: INestApplication, prisma: PrismaService, campaignId: string, nb: string;
  const ck: Record<string, string[]> = {}, id: Record<string, string> = {};
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());
  const login = async (k: string) => (await api().post('/api/v1/auth/login').send({ email: `${k}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `sp-${stamp}`, name: 'Sup' } })).id;
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } })).id;
    const pw = await argon2.hash('pw');
    await prisma.user.create({ data: { campaignId, email: `cand-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    await prisma.user.create({ data: { campaignId, email: `aud-${stamp}@exemplo.test`, name: 'Au', role: 'AUDITOR', passwordHash: pw } });
    for (const k of ['la', 'lb']) {
      const u = await prisma.user.create({ data: { campaignId, email: `${k}-${stamp}@exemplo.test`, name: k, role: 'LIDERANCA', passwordHash: pw } });
      id[k] = (await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: nb, name: k } })).id;
    }
    for (const k of ['cand', 'aud', 'la', 'lb']) ck[k] = await login(k);
  });
  afterAll(async () => {
    await prisma.accessLog.deleteMany({ where: { campaignId } });
    await prisma.consent.deleteMany({ where: { campaignId } });
    await prisma.supporter.deleteMany({ where: { campaignId } });
    await prisma.leader.deleteMany({ where: { campaignId } });
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.neighborhood.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  const create = (who: string, extra: any = {}) =>
    api().post('/api/v1/supporters').set('Cookie', ck[who]).send({ name: 'Zé Exemplo', neighborhoodId: nb, consent: CONSENT, ...extra });

  it('CA-11: sem consentimento → 422 CONSENT_REQUIRED', async () => {
    const r = await api().post('/api/v1/supporters').set('Cookie', ck.la).send({ name: 'Sem', neighborhoodId: nb }).expect(422);
    expect(r.body.code).toBe('CONSENT_REQUIRED');
    expect(await prisma.supporter.count({ where: { campaignId } })).toBe(0);
  });

  it('cria com consentimento, cifra PII, guarda o ponto com jitter e atualiza atividade da liderança', async () => {
    const r = await create('la', { phone: '(86) 90000-0001', cpf: '000.000.000-00', address: 'Rua Exemplo, 1', lat: -5.0892, lng: -42.8019 }).expect(201);
    id.sA = r.body.id;
    expect(r.body.duplicatePhone).toBe(false);
    expect(r.body.removalToken).toBeUndefined();
    const [row] = await prisma.$queryRaw<any[]>`SELECT "phoneEnc","mapPoint" IS NOT NULL has_point FROM "Supporter" WHERE id = ${id.sA}`;
    expect(Buffer.from(row.phoneEnc).toString('latin1')).not.toContain('90000');
    expect(row.has_point).toBe(true);
    expect(await prisma.consent.count({ where: { supporterId: id.sA } })).toBe(1);
    expect((await prisma.leader.findUniqueOrThrow({ where: { id: id.la } })).lastActivityAt).not.toBeNull();
  });

  it('CB-10: telefone repetido sinaliza duplicidade sem bloquear', async () => {
    const r = await create('la', { name: 'Outro', phone: '86 90000-0001' }).expect(201);
    expect(r.body.duplicatePhone).toBe(true);
  });

  it('CA-02/CB-05: liderança B não vê o apoiador de A (404) e o acesso é logado', async () => {
    await api().get(`/api/v1/supporters/${id.sA}`).set('Cookie', ck.lb).expect(404);
    const denied = await prisma.accessLog.findFirst({ where: { campaignId, resourceId: id.sA, outcome: 'DENIED' } });
    expect(denied?.role).toBe('LIDERANCA');
    const list = await api().get('/api/v1/supporters').set('Cookie', ck.lb).expect(200);
    expect(list.body.data).toEqual([]);
  });

  it('dono e candidato veem PII decifrada; leitura gera log', async () => {
    for (const who of ['la', 'cand']) {
      const r = await api().get(`/api/v1/supporters/${id.sA}`).set('Cookie', ck[who]).expect(200);
      expect(r.body).toMatchObject({ phone: '(86) 90000-0001', address: 'Rua Exemplo, 1', location: { lat: -5.0892, lng: -42.8019 } });
      expect(r.body.consents).toHaveLength(1);
    }
    expect(await prisma.accessLog.count({ where: { campaignId, resourceId: id.sA, action: 'READ', outcome: 'OK' } })).toBe(2);
  });

  it('CA-04: auditor não acessa cadastros (403)', async () => {
    await api().get(`/api/v1/supporters/${id.sA}`).set('Cookie', ck.aud).expect(403);
    await api().get('/api/v1/supporters').set('Cookie', ck.aud).expect(403);
  });

  it('lista não traz PII', async () => {
    const r = await api().get('/api/v1/supporters').set('Cookie', ck.cand).expect(200);
    expect(JSON.stringify(r.body)).not.toMatch(/90000|Rua Exemplo|phone|cpf|address/);
    expect(r.body.data[0].hasActiveConsent).toBe(true);
  });

  it('liderança não cadastra em nome de outra', async () => {
    await create('la', { leaderId: id.lb }).expect(422);
  });
});
