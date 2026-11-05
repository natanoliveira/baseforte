import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

const CONSENT = { channel: 'presencial', purpose: 'comunicacao-campanha', textVersion: 'v1', textAccepted: 'Autorizo contato sobre a campanha.' };

describe('DPO, ROPA e visão do auditor (RF-23/26, CA-17)', () => {
  let app: INestApplication, prisma: PrismaService, campaignId: string, ck: string[], au: string[], lid: string[];
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `pv-${stamp}`, name: 'Priv' } })).id;
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    const nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } })).id;
    const pw = await argon2.hash('pw');
    await prisma.user.create({ data: { campaignId, email: `cand-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    await prisma.user.create({ data: { campaignId, email: `aud-${stamp}@exemplo.test`, name: 'Au', role: 'AUDITOR', passwordHash: pw } });
    const ul = await prisma.user.create({ data: { campaignId, email: `lid-${stamp}@exemplo.test`, name: 'L', role: 'LIDERANCA', passwordHash: pw } });
    const l = await prisma.leader.create({ data: { campaignId, userId: ul.id, neighborhoodId: nb, name: 'L' } });
    const login = async (k: string) => (await api().post('/api/v1/auth/login').send({ email: `${k}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
    ck = await login('cand'); au = await login('aud'); lid = await login('lid');
    await api().post('/api/v1/supporters').set('Cookie', ck).send({ name: 'Ap', phone: '(86) 90000-0009', neighborhoodId: nb, leaderId: l.id, consent: CONSENT }).expect(201);
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

  it('DPO: candidato edita; página pública mostra sem login; auditor não edita', async () => {
    await api().put('/api/v1/privacy/dpo').set('Cookie', ck).send({ dpoName: 'Encarregada Exemplo', dpoEmail: 'dpo@exemplo.test' }).expect(200);
    const pub = await api().get(`/api/v1/public/dpo/pv-${stamp}`).expect(200);
    expect(pub.body).toMatchObject({ campaignName: 'Priv', dpoName: 'Encarregada Exemplo', dpoEmail: 'dpo@exemplo.test' });
    await api().get('/api/v1/public/dpo/nao-existe').expect(404);
    await api().put('/api/v1/privacy/dpo').set('Cookie', au).send({ dpoName: 'X Y', dpoEmail: 'x@exemplo.test' }).expect(403);
    await api().put('/api/v1/privacy/dpo').set('Cookie', ck).send({ dpoName: 'X', dpoEmail: 'inválido' }).expect(422);
  });

  it('CA-17: auditor lê consentimentos e logs, mas não cadastros nem escreve', async () => {
    const c = await api().get('/api/v1/privacy/consents').set('Cookie', au).expect(200);
    expect(c.body.data).toHaveLength(1);
    expect(c.body.data[0]).toMatchObject({ supporterName: 'Ap', purpose: 'comunicacao-campanha', revokedAt: null });
    expect(JSON.stringify(c.body)).not.toContain('90000');
    const l = await api().get('/api/v1/privacy/access-logs?action=CREATE').set('Cookie', au).expect(200);
    expect(l.body.data.length).toBeGreaterThan(0);
    await api().get('/api/v1/supporters').set('Cookie', au).expect(403);
    await api().post('/api/v1/leaders').set('Cookie', au).send({}).expect(403);
    await api().get('/api/v1/privacy/consents').set('Cookie', lid).expect(403);
  });

  it('ROPA: JSON, CSV e PDF', async () => {
    const j = await api().get('/api/v1/privacy/ropa').set('Cookie', ck).expect(200);
    expect(j.body.stats).toEqual({ supporters: 1, withActiveConsent: 1, removals: 0 });
    const csv = await api().get('/api/v1/privacy/ropa.csv').set('Cookie', au).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('Cadastro de apoiadores');
    const pdf = await api().get('/api/v1/privacy/ropa.pdf').set('Cookie', ck).buffer().parse((res, cb) => {
      const chunks: Buffer[] = []; res.on('data', (d: Buffer) => chunks.push(d)); res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });
});
