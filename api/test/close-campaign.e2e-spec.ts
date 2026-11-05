import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

const CONSENT = { channel: 'presencial', purpose: 'comunicacao-campanha', textVersion: 'v1', textAccepted: 'Autorizo contato sobre a campanha.' };

describe('encerrar campanha (RF-24, CA-14, CB-08)', () => {
  let app: INestApplication, prisma: PrismaService;
  const stamp = Date.now();
  const made: string[] = [];
  const api = () => request(app.getHttpServer());

  async function setup(tag: string) {
    const campaignId = (await prisma.campaign.create({ data: { slug: `cc-${tag}-${stamp}`, name: `Campanha ${tag}` } })).id;
    made.push(campaignId);
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    const nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } })).id;
    const pw = await argon2.hash('pw');
    await prisma.user.create({ data: { campaignId, email: `cand-${tag}-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    const ul = await prisma.user.create({ data: { campaignId, email: `l-${tag}-${stamp}@exemplo.test`, name: 'L', role: 'LIDERANCA', passwordHash: pw } });
    const leaderId = (await prisma.leader.create({ data: { campaignId, userId: ul.id, neighborhoodId: nb, name: 'L' } })).id;
    const ck = (await api().post('/api/v1/auth/login').send({ email: `cand-${tag}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
    const ids: string[] = [];
    for (const n of ['apoio-a', 'apoio-b']) {
      ids.push((await api().post('/api/v1/supporters').set('Cookie', ck).send({ name: n, phone: '(86) 90000-0005', neighborhoodId: nb, leaderId, consent: CONSENT }).expect(201)).body.id);
    }
    await prisma.consent.updateMany({ where: { supporterId: ids[1] }, data: { revokedAt: new Date() } });
    return { campaignId, ck, nb, leaderId };
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
  });
  afterAll(async () => {
    for (const campaignId of made) {
      await prisma.accessLog.deleteMany({ where: { campaignId } });
      await prisma.removalRecord.deleteMany({ where: { campaignId } });
      await prisma.consent.deleteMany({ where: { campaignId } });
      await prisma.supporter.deleteMany({ where: { campaignId } });
      await prisma.leader.deleteMany({ where: { campaignId } });
      await prisma.user.deleteMany({ where: { campaignId } });
      await prisma.neighborhood.deleteMany({ where: { campaignId } });
      await prisma.region.deleteMany({ where: { campaignId } });
      await prisma.campaign.delete({ where: { id: campaignId } });
    }
    await app.close();
  });

  it('política padrão ANONIMIZAR: exige confirmação dupla, anonimiza todos e vira somente leitura', async () => {
    const { campaignId, ck, nb, leaderId } = await setup('an');
    expect((await api().get('/api/v1/privacy/retention-policy').set('Cookie', ck)).body.policy).toBe('ANONIMIZAR');
    await api().post('/api/v1/privacy/close-campaign').set('Cookie', ck).send({ confirm1: true, confirm2: 'errado' }).expect(422);
    await api().post('/api/v1/privacy/close-campaign').set('Cookie', ck).send({ confirm1: false, confirm2: 'Campanha an' }).expect(422);
    expect(await prisma.supporter.count({ where: { campaignId, anonymizedAt: null } })).toBe(2);

    const r = await api().post('/api/v1/privacy/close-campaign').set('Cookie', ck).send({ confirm1: true, confirm2: 'Campanha an' }).expect(200);
    expect(r.body).toMatchObject({ policy: 'ANONIMIZAR', supporters: 2 });
    expect(await prisma.supporter.count({ where: { campaignId, anonymizedAt: null } })).toBe(0);
    expect(await prisma.consent.count({ where: { campaignId, revokedAt: null } })).toBe(0);
    expect(await prisma.removalRecord.count({ where: { campaignId } })).toBe(2);
    expect(await prisma.accessLog.count({ where: { campaignId, action: 'CLOSE_CAMPAIGN' } })).toBe(1);

    const w = await api().post('/api/v1/supporters').set('Cookie', ck).send({ name: 'x', neighborhoodId: nb, leaderId, consent: CONSENT }).expect(409);
    expect(w.body.code).toBe('CAMPAIGN_CLOSED');
    await api().post('/api/v1/privacy/close-campaign').set('Cookie', ck).send({ confirm1: true, confirm2: 'Campanha an' }).expect(409);
    await api().get('/api/v1/supporters').set('Cookie', ck).expect(200);
  });

  it('política APAGAR (CB-08): remove todos, com ou sem consentimento, e mantém só o registro mínimo', async () => {
    const { campaignId, ck } = await setup('ap');
    await api().put('/api/v1/privacy/retention-policy').set('Cookie', ck).send({ policy: 'APAGAR' }).expect(200);
    await api().post('/api/v1/privacy/close-campaign').set('Cookie', ck).send({ confirm1: true, confirm2: 'Campanha ap' }).expect(200);
    expect(await prisma.supporter.count({ where: { campaignId } })).toBe(0);
    expect(await prisma.consent.count({ where: { campaignId } })).toBe(0);
    expect(await prisma.removalRecord.count({ where: { campaignId } })).toBe(2);
  });
});
