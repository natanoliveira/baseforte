import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

describe('árvore e mover (RF-07, CA-06, CB-01)', () => {
  let app: INestApplication, prisma: PrismaService;
  let campaignId: string, c1: string, c2: string, creg: string[], lid: string[];
  const id: Record<string, string> = {};
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());
  const login = async (k: string) => (await api().post('/api/v1/auth/login').send({ email: `${k.toLowerCase()}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `t-${stamp}`, name: 'Tree' } })).id;
    const r1 = await prisma.region.create({ data: { campaignId, name: 'R1' } });
    const r2 = await prisma.region.create({ data: { campaignId, name: 'R2' } });
    const nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: r1.id, name: 'N1' } })).id;
    const pw = await argon2.hash('pw');
    c1 = (await prisma.user.create({ data: { campaignId, email: `creg-${stamp}@exemplo.test`, name: 'C1', role: 'COORD_REGIAO', regionId: r1.id, passwordHash: pw } })).id;
    c2 = (await prisma.user.create({ data: { campaignId, email: `c2-${stamp}@exemplo.test`, name: 'C2', role: 'COORD_REGIAO', regionId: r2.id, passwordHash: pw } })).id;
    const mk = async (k: string, parentId?: string, coordinatorId?: string) => {
      const u = await prisma.user.create({ data: { campaignId, email: `${k.toLowerCase()}-${stamp}@exemplo.test`, name: k, role: 'LIDERANCA', passwordHash: pw } });
      id[k] = (await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: nb, name: k, parentId, coordinatorId } })).id;
    };
    await mk('A', undefined, c1); await mk('A2', id.A); await mk('A3', id.A2); await mk('B', undefined, c1);
    creg = await login('creg'); lid = await login('A');
  });
  afterAll(async () => {
    await prisma.accessLog.deleteMany({ where: { campaignId } });
    await prisma.leader.deleteMany({ where: { campaignId, parentId: { not: null } } });
    await prisma.leader.deleteMany({ where: { campaignId } });
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.neighborhood.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  it('GET /leaders/tree devolve lista plana no escopo', async () => {
    const r = await api().get('/api/v1/leaders/tree').set('Cookie', creg).expect(200);
    expect(r.body.coordinators.map((c: any) => c.name)).toEqual(['C1']);
    expect(r.body.leaders.map((l: any) => l.name).sort()).toEqual(['A', 'A2', 'A3', 'B']);
    const mine = await api().get('/api/v1/leaders/tree').set('Cookie', lid).expect(200);
    expect(mine.body.leaders.map((l: any) => l.name).sort()).toEqual(['A', 'A2', 'A3']);
  });

  it('CA-06: mover A para B leva a subárvore e gera 1 log', async () => {
    await api().post(`/api/v1/leaders/${id.A}/move`).set('Cookie', creg).send({ parentId: id.B }).expect(200);
    const r = await api().get('/api/v1/leaders/tree').set('Cookie', creg);
    const byName = Object.fromEntries(r.body.leaders.map((l: any) => [l.name, l]));
    expect(byName.A.parentId).toBe(id.B);
    expect(byName.A.coordinatorId).toBeNull();
    expect(byName.A2.parentId).toBe(id.A);
    expect(byName.A3.parentId).toBe(id.A2);
    expect(await prisma.accessLog.count({ where: { campaignId, action: 'MOVE' } })).toBe(1);
  });

  it('CB-01/ciclo: mover B para dentro de sua própria subárvore → 422', async () => {
    await api().post(`/api/v1/leaders/${id.B}/move`).set('Cookie', creg).send({ parentId: id.A3 }).expect(422);
    await api().post(`/api/v1/leaders/${id.B}/move`).set('Cookie', creg).send({ parentId: id.B }).expect(422);
  });

  it('coord de região não move para coordenador de outra região; liderança não move', async () => {
    await api().post(`/api/v1/leaders/${id.B}/move`).set('Cookie', creg).send({ coordinatorId: c2 }).expect(422);
    await api().post(`/api/v1/leaders/${id.B}/move`).set('Cookie', creg).send({ coordinatorId: c1 }).expect(200);
    await api().post(`/api/v1/leaders/${id.A2}/move`).set('Cookie', lid).send({ parentId: id.A }).expect(403);
    await api().post(`/api/v1/leaders/${id.B}/move`).set('Cookie', creg).send({}).expect(422);
  });
});
