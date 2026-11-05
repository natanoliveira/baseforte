import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { distanceMeters } from '../src/common/jitter';
import { PrismaService } from '../src/tenancy/prisma.service';

const CONSENT = { channel: 'presencial', purpose: 'comunicacao-campanha', textVersion: 'v1', textAccepted: 'Autorizo contato sobre a campanha.' };
const SQ = (x: number, y: number) => `POLYGON((${x} ${y},${x + 0.02} ${y},${x + 0.02} ${y + 0.02},${x} ${y + 0.02},${x} ${y}))`;
const EXACT = { lat: -5.1, lng: -42.84 };

describe('mapa (RF-11..15, CA-03, CA-08, CA-09, CB-03)', () => {
  let app: INestApplication, prisma: PrismaService, campaignId: string;
  const id: Record<string, string> = {}, ck: Record<string, string[]> = {};
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());
  const get = (p: string, who: string) => api().get(`/api/v1${p}`).set('Cookie', ck[who]);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `mp-${stamp}`, name: 'Mapa' } })).id;
    const r1 = await prisma.region.create({ data: { campaignId, name: 'R1' } });
    const r2 = await prisma.region.create({ data: { campaignId, name: 'R2' } });
    for (const [k, r, x] of [['n1', r1.id, -42.85], ['n2', r2.id, -42.8]] as const) {
      id[k] = (await prisma.neighborhood.create({ data: { campaignId, regionId: r, name: k } })).id;
      await prisma.$executeRawUnsafe(`UPDATE "Neighborhood" SET geom = ST_Multi(ST_GeomFromText('${SQ(x, -5.11)}',4326)), centroid = ST_SetSRID(ST_MakePoint(${x + 0.01},-5.1),4326) WHERE id = '${id[k]}'`);
    }
    await prisma.$executeRaw`INSERT INTO "VotingPlace" (id,"campaignId","neighborhoodId",name,location) VALUES (gen_random_uuid(),${campaignId},${id.n1},'Escola Exemplo',ST_SetSRID(ST_MakePoint(-42.84,-5.1),4326))`;
    const pw = await argon2.hash('pw');
    await prisma.user.create({ data: { campaignId, email: `cand-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    await prisma.user.create({ data: { campaignId, email: `aud-${stamp}@exemplo.test`, name: 'A', role: 'AUDITOR', passwordHash: pw } });
    await prisma.user.create({ data: { campaignId, email: `creg-${stamp}@exemplo.test`, name: 'CR', role: 'COORD_REGIAO', regionId: r1.id, passwordHash: pw } });
    for (const k of ['la', 'lb']) {
      const u = await prisma.user.create({ data: { campaignId, email: `${k}-${stamp}@exemplo.test`, name: k, role: 'LIDERANCA', passwordHash: pw } });
      id[k] = (await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: id.n1, name: k, goal: k === 'la' ? 10 : 0, lastActivityAt: new Date() } })).id;
    }
    for (const k of ['cand', 'aud', 'creg', 'la']) ck[k] = (await api().post('/api/v1/auth/login').send({ email: `${k}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
    for (let i = 0; i < 5; i++) {
      await api().post('/api/v1/supporters').set('Cookie', ck.cand).send({ name: `ap-${i}-x`, neighborhoodId: id.n1, leaderId: id.la, lat: EXACT.lat, lng: EXACT.lng, consent: CONSENT }).expect(201);
    }
    await api().post('/api/v1/supporters').set('Cookie', ck.cand).send({ name: 'ap-lb', neighborhoodId: id.n1, leaderId: id.lb, lat: EXACT.lat, lng: EXACT.lng, consent: CONSENT }).expect(201);
  });
  afterAll(async () => {
    await prisma.accessLog.deleteMany({ where: { campaignId } });
    await prisma.consent.deleteMany({ where: { campaignId } });
    await prisma.supporter.deleteMany({ where: { campaignId } });
    await prisma.votingPlace.deleteMany({ where: { campaignId } });
    await prisma.leader.deleteMany({ where: { campaignId } });
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.neighborhood.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  it('CA-03: calor só devolve pontos deslocados (30–200 m), sem id/nome, e nunca o exato', async () => {
    const r = await get('/map/heatmap', 'cand').expect(200);
    expect(r.body.features).toHaveLength(6);
    for (const f of r.body.features) {
      const [lng, lat] = f.geometry.coordinates;
      const d = distanceMeters(EXACT, { lat, lng });
      expect(d).toBeGreaterThanOrEqual(29); expect(d).toBeLessThanOrEqual(201);
      expect(f.properties).toEqual({});
    }
    expect(JSON.stringify(r.body)).not.toMatch(/-5\.1[,\]]|-42\.84[,\]]/);
  });

  it('liderança vê só a própria base no calor; auditor é negado', async () => {
    expect((await get('/map/heatmap', 'la').expect(200)).body.features).toHaveLength(5);
    await get('/map/heatmap', 'aud').expect(403);
    await get('/map/leaders', 'aud').expect(403);
  });

  it('pins de lideranças com status, apoiadores e % da meta; meta 0 → null', async () => {
    const r = await get('/map/leaders', 'cand').expect(200);
    const by = Object.fromEntries(r.body.features.map((f: any) => [f.properties.name, f.properties]));
    expect(by.la).toMatchObject({ status: 'ATIVO', supporters: 5, goal: 10, goalPct: 50 });
    expect(by.lb).toMatchObject({ supporters: 1, goal: 0, goalPct: null });
    const f = await get('/map/leaders?goalMin=5', 'cand').expect(200);
    expect(f.body.features.map((x: any) => x.properties.name)).toEqual(['la']);
    const s = await get('/map/leaders?status=INATIVO', 'cand').expect(200);
    expect(s.body.features).toHaveLength(0);
  });

  it('CA-09/CB-03: coroplético com % da meta e bairro sem meta = null', async () => {
    const r = await get('/map/choropleth', 'cand').expect(200);
    const by = Object.fromEntries(r.body.features.map((f: any) => [f.properties.name, f.properties]));
    expect(by.n1).toMatchObject({ goal: 10, supporters: 6, pct: 60 });
    expect(by.n2).toMatchObject({ goal: 0, supporters: 0, pct: null });
    const la = await get('/map/choropleth', 'la').expect(200);
    expect(la.body.features.find((f: any) => f.properties.name === 'n1').properties.supporters).toBe(5);
  });

  it('CA-08: bairros sem liderança aparecem como vazios; coord de região só vê a sua região', async () => {
    const g = await get('/map/gaps', 'cand').expect(200);
    expect(g.body.features.map((f: any) => f.properties.name)).toEqual(['n2']);
    expect((await get('/map/gaps', 'creg').expect(200)).body.features).toEqual([]);
    const c = await get('/map/choropleth', 'creg').expect(200);
    expect(c.body.features.map((f: any) => f.properties.name)).toEqual(['n1']);
  });

  it('RF-16: relatório PDF do bairro (sem PII); fora do escopo → 404', async () => {
    const pdf = await get(`/neighborhoods/${id.n1}/report.pdf`, 'cand').buffer().parse((res, cb) => {
      const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c)));
    }).expect(200);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    await get(`/neighborhoods/${id.n2}/report.pdf`, 'creg').expect(404);
  });

  it('locais de votação e painel do bairro', async () => {
    expect((await get('/map/voting-places', 'cand').expect(200)).body.features).toHaveLength(1);
    const p = await get(`/neighborhoods/${id.n1}/panel`, 'cand').expect(200);
    expect(p.body).toMatchObject({ supporters: 6, goal: 10, pct: 60, requests: [], gaps: { noLeaders: false, belowGoal: true } });
    expect(p.body.leaders.map((l: any) => l.name)).toEqual(['la', 'lb']);
    expect(p.body.votingPlaces).toHaveLength(1);
    const empty = await get(`/neighborhoods/${id.n2}/panel`, 'cand').expect(200);
    expect(empty.body.gaps.noLeaders).toBe(true);
    await get(`/neighborhoods/${id.n2}/panel`, 'creg').expect(404);
  });
});
