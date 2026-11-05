import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

const CONSENT = { channel: 'presencial', purpose: 'comunicacao-campanha', textVersion: 'v1', textAccepted: 'Autorizo contato sobre a campanha.' };

describe('consentimento e lista de comunicação (RF-21, CA-12)', () => {
  let app: INestApplication, prisma: PrismaService, campaignId: string, nb: string, cookies: string[], lb: string[];
  const id: Record<string, string> = {};
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `cs-${stamp}`, name: 'Cons' } })).id;
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } })).id;
    const pw = await argon2.hash('pw');
    await prisma.user.create({ data: { campaignId, email: `cand-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    const u = await prisma.user.create({ data: { campaignId, email: `lb-${stamp}@exemplo.test`, name: 'lb', role: 'LIDERANCA', passwordHash: pw } });
    const ul = await prisma.user.create({ data: { campaignId, email: `l-${stamp}@exemplo.test`, name: 'l', role: 'LIDERANCA', passwordHash: pw } });
    id.l = (await prisma.leader.create({ data: { campaignId, userId: ul.id, neighborhoodId: nb, name: 'l' } })).id;
    await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: nb, name: 'lb' } });
    const login = async (k: string) => (await api().post('/api/v1/auth/login').send({ email: `${k}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
    cookies = await login('cand'); lb = await login('lb');
    for (const [k, phone] of [['ok', '(86) 90000-0001'], ['revog', '(86) 90000-0002']]) {
      const r = await api().post('/api/v1/supporters').set('Cookie', cookies).send({ name: k, phone, neighborhoodId: nb, leaderId: id.l, consent: CONSENT }).expect(201);
      id[k] = r.body.id;
    }
    await prisma.consent.updateMany({ where: { supporterId: id.revog }, data: { revokedAt: new Date() } });
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

  it('lista de comunicação só traz consentidos e sem PII', async () => {
    const r = await api().get('/api/v1/communication/list').set('Cookie', cookies).expect(200);
    expect(r.body.data.map((s: any) => s.name)).toEqual(['ok']);
    expect(JSON.stringify(r.body)).not.toContain('90000');
  });

  it('wa.me só para consentido; sem consentimento → 422 e sem link', async () => {
    const ok = await api().get(`/api/v1/communication/wa-link/${id.ok}?text=Ol%C3%A1`).set('Cookie', cookies).expect(200);
    expect(ok.body.url).toBe('https://wa.me/5586900000001?text=Ol%C3%A1');
    const no = await api().get(`/api/v1/communication/wa-link/${id.revog}`).set('Cookie', cookies).expect(422);
    expect(no.body.code).toBe('CONSENT_REQUIRED');
    expect(no.body.url).toBeUndefined();
  });

  it('reconceder consentimento devolve o apoiador à lista; escopo vale para a conceder', async () => {
    await api().post(`/api/v1/supporters/${id.revog}/consents`).set('Cookie', lb).send(CONSENT).expect(404);
    await api().post(`/api/v1/supporters/${id.revog}/consents`).set('Cookie', cookies).send(CONSENT).expect(201);
    const r = await api().get('/api/v1/communication/list').set('Cookie', cookies).expect(200);
    expect(r.body.data.map((s: any) => s.name).sort()).toEqual(['ok', 'revog']);
  });
});
