import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

describe('regiões e bairros (RN-07, CB-07)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let campaignId: string;
  let r1: string, r2: string, n1: string;
  let cand: string[], creg: string[];
  const stamp = Date.now();
  const api = () => request(app.getHttpServer());
  const login = async (k: string) => (await api().post('/api/v1/auth/login').send({ email: `${k}-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `rg-${stamp}`, name: 'Reg' } })).id;
    r1 = (await prisma.region.create({ data: { campaignId, name: 'R1' } })).id;
    r2 = (await prisma.region.create({ data: { campaignId, name: 'R2' } })).id;
    n1 = (await prisma.neighborhood.create({ data: { campaignId, regionId: r1, name: 'N1' } })).id;
    await prisma.neighborhood.create({ data: { campaignId, regionId: r2, name: 'N2' } });
    await prisma.$executeRaw`UPDATE "Neighborhood" SET geom = ST_Multi(ST_GeomFromText('POLYGON((-42.8 -5.1,-42.7 -5.1,-42.7 -5.0,-42.8 -5.0,-42.8 -5.1))',4326)), centroid = ST_SetSRID(ST_MakePoint(-42.75,-5.05),4326) WHERE id = ${n1}`;
    const pw = await argon2.hash('pw');
    await prisma.user.create({ data: { campaignId, email: `cand-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    await prisma.user.create({ data: { campaignId, email: `creg-${stamp}@exemplo.test`, name: 'CR', role: 'COORD_REGIAO', regionId: r1, passwordHash: pw } });
    cand = await login('cand'); creg = await login('creg');
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.neighborhood.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  it('candidato vê todos os bairros, com geometria GeoJSON', async () => {
    const r = await api().get('/api/v1/neighborhoods').set('Cookie', cand).expect(200);
    expect(r.body.map((n: any) => n.name)).toEqual(['N1', 'N2']);
    expect(r.body[0].geometry.type).toBe('MultiPolygon');
  });

  it('coord de região vê só a sua; mover bairro altera o escopo na hora (CB-07)', async () => {
    let r = await api().get('/api/v1/neighborhoods').set('Cookie', creg).expect(200);
    expect(r.body.map((n: any) => n.name)).toEqual(['N1']);
    await api().patch(`/api/v1/neighborhoods/${n1}/region`).set('Cookie', creg).send({ regionId: r2 }).expect(403);
    await api().patch(`/api/v1/neighborhoods/${n1}/region`).set('Cookie', cand).send({ regionId: r2 }).expect(200);
    r = await api().get('/api/v1/neighborhoods').set('Cookie', creg).expect(200);
    expect(r.body).toEqual([]);
  });
});
