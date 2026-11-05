import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

const CONSENT = { channel: 'presencial', purpose: 'comunicacao-campanha', textVersion: 'v1', textAccepted: 'Autorizo contato sobre a campanha.' };

describe('descadastro (RF-22, CA-13, CB-04)', () => {
  let app: INestApplication, prisma: PrismaService, campaignId: string, nb: string, ck: string[], lb: string[], la: string[];
  const id: Record<string, string> = {}, tok: Record<string, string> = {};
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `rm-${stamp}`, name: 'Rem' } })).id;
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } })).id;
    const pw = await argon2.hash('pw');
    await prisma.user.create({ data: { campaignId, email: `cand-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    for (const k of ['la', 'lb']) {
      const u = await prisma.user.create({ data: { campaignId, email: `${k}-${stamp}@exemplo.test`, name: k, role: 'LIDERANCA', passwordHash: pw } });
      id[k] = (await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: nb, name: k } })).id;
    }
    const login = async (k: string) => (await api().post('/api/v1/auth/login').send({ email: `${k}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
    ck = await login('cand'); la = await login('la'); lb = await login('lb');
    for (const k of ['pub', 'staff']) {
      const r = await api().post('/api/v1/supporters').set('Cookie', ck).send({ name: k, phone: '(86) 90000-0003', address: 'Rua X', lat: -5.09, lng: -42.8, neighborhoodId: nb, leaderId: id.la, consent: CONSENT }).expect(201);
      id[k] = r.body.id;
      tok[k] = (await prisma.supporter.findUniqueOrThrow({ where: { id: r.body.id } })).removalToken;
    }
  });
  afterAll(async () => {
    await prisma.accessLog.deleteMany({ where: { campaignId } });
    await prisma.removalRecord.deleteMany({ where: { campaignId } });
    await prisma.consent.deleteMany({ where: { campaignId } });
    await prisma.supporter.deleteMany({ where: { campaignId } });
    await prisma.leader.deleteMany({ where: { campaignId } });
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.neighborhood.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  it('CA-13: link público anonimiza, remove das listas, gera 1 log e 1 registro mínimo', async () => {
    const info = await api().get(`/api/v1/public/remove-data/${tok.pub}`).expect(200);
    expect(info.body).toMatchObject({ campaignName: 'Rem', alreadyRemoved: false });
    await api().post(`/api/v1/public/remove-data/${tok.pub}`).expect(200).expect({ removed: true, alreadyRemoved: false });

    const [row] = await prisma.$queryRaw<any[]>`SELECT name, "phoneEnc", "addressEnc", "locationEnc", "mapPoint" IS NULL no_point, "anonymizedAt" FROM "Supporter" WHERE id = ${id.pub}`;
    expect(row).toMatchObject({ name: 'Cadastro removido', phoneEnc: null, addressEnc: null, locationEnc: null, no_point: true });
    expect(row.anonymizedAt).not.toBeNull();
    expect(await prisma.consent.count({ where: { supporterId: id.pub, revokedAt: null } })).toBe(0);

    const list = await api().get('/api/v1/communication/list').set('Cookie', ck).expect(200);
    expect(list.body.data.map((s: any) => s.name)).toEqual(['staff']);
    const all = await api().get('/api/v1/supporters').set('Cookie', ck).expect(200);
    expect(all.body.data.map((s: any) => s.name)).toEqual(['staff']);
    await api().get(`/api/v1/communication/wa-link/${id.pub}`).set('Cookie', ck).expect(422);
    const det = await api().get(`/api/v1/supporters/${id.pub}`).set('Cookie', ck).expect(200);
    expect(det.body).toMatchObject({ phone: null, address: null, location: null });

    expect(await prisma.removalRecord.count({ where: { campaignId } })).toBe(1);
    expect(await prisma.accessLog.count({ where: { campaignId, action: 'REMOVE', resourceId: id.pub } })).toBe(1);
  });

  it('CB-04: repetir é idempotente (200, sem novo log); token desconhecido → 404', async () => {
    await api().post(`/api/v1/public/remove-data/${tok.pub}`).expect(200).expect({ removed: true, alreadyRemoved: true });
    expect(await prisma.removalRecord.count({ where: { campaignId } })).toBe(1);
    expect(await prisma.accessLog.count({ where: { campaignId, action: 'REMOVE' } })).toBe(1);
    await api().post('/api/v1/public/remove-data/00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('descadastro pela equipe respeita o escopo', async () => {
    await api().post(`/api/v1/supporters/${id.staff}/revoke`).set('Cookie', lb).expect(404);
    await api().post(`/api/v1/supporters/${id.staff}/revoke`).set('Cookie', la).expect(200).expect({ removed: true, alreadyRemoved: false });
    const log = await prisma.accessLog.findFirst({ where: { campaignId, action: 'REMOVE', resourceId: id.staff } });
    expect(log?.role).toBe('LIDERANCA');
  });
});
