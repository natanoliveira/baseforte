import { Controller, Get, INestApplication, NotFoundException, Param } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { LogAccess } from '../src/common/access-log.interceptor';
import { Roles } from '../src/common/roles.decorator';
import { SensitiveDataService } from '../src/common/sensitive-data.service';
import { GeoRepository } from '../src/common/geo.repository';
import { distanceMeters } from '../src/common/jitter';
import { PrismaService } from '../src/tenancy/prisma.service';
import { ClsService } from 'nestjs-cls';

@Controller('probe-log')
class LogProbe {
  @Get(':id') @Roles('CANDIDATO') @LogAccess('supporter')
  get(@Param('id') id: string) { if (id === 'nope') throw new NotFoundException(); return { id }; }
}

describe('dados sensíveis, geo e log de acesso', () => {
  let app: INestApplication, prisma: PrismaService, sens: SensitiveDataService, geo: GeoRepository, cls: ClsService;
  let campaignId: string, cookies: string[];
  const stamp = Date.now();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule], controllers: [LogProbe] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService); sens = mod.get(SensitiveDataService); geo = mod.get(GeoRepository); cls = mod.get(ClsService);
    campaignId = (await prisma.campaign.create({ data: { slug: `s-${stamp}`, name: 'Sens' } })).id;
    await prisma.user.create({ data: { campaignId, email: `c-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: await argon2.hash('pw') } });
    cookies = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: `c-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
  });
  afterAll(async () => {
    await prisma.supporter.deleteMany({ where: { campaignId } });
    await prisma.leader.deleteMany({ where: { campaignId } });
    await prisma.accessLog.deleteMany({ where: { campaignId } });
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.neighborhood.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  it('CA-15: cifra em repouso e só decifra com a chave certa', async () => {
    const enc = await sens.encrypt('(86) 90000-0000');
    expect(enc.toString('latin1')).not.toContain('90000');
    expect(await sens.decrypt(enc)).toBe('(86) 90000-0000');
    await expect(prisma.$queryRaw`SELECT pgp_sym_decrypt(${enc}::bytea, 'chave-errada')`).rejects.toThrow();
    expect(await sens.decrypt(null)).toBeNull();
  });

  it('setSupporterLocation guarda exato cifrado e ponto de mapa com jitter', async () => {
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    const nb = await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } });
    const u = await prisma.user.create({ data: { campaignId, email: `l-${stamp}@exemplo.test`, name: 'L', role: 'LIDERANCA', passwordHash: 'x' } });
    const ld = await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: nb.id, name: 'L' } });
    const s = await prisma.supporter.create({ data: { campaignId, leaderId: ld.id, neighborhoodId: nb.id, name: 'S', jitterSeed: 42 } });
    await cls.run(async () => {
      cls.set('campaignId', campaignId);
      await geo.setSupporterLocation(s.id, -5.0892, -42.8019, 42);
    });
    const [row] = await prisma.$queryRaw<any[]>`SELECT ST_Y("mapPoint") lat, ST_X("mapPoint") lng, "locationEnc" FROM "Supporter" WHERE id = ${s.id}`;
    const d = distanceMeters({ lat: -5.0892, lng: -42.8019 }, row);
    expect(d).toBeGreaterThanOrEqual(29);
    expect(d).toBeLessThanOrEqual(201);
    expect(JSON.parse((await sens.decrypt(row.locationEnc))!)).toEqual({ lat: -5.0892, lng: -42.8019 });
  });

  it('CA-16: leitura gera log; 404 vira DENIED', async () => {
    await request(app.getHttpServer()).get('/api/v1/probe-log/abc').set('Cookie', cookies).expect(200);
    await request(app.getHttpServer()).get('/api/v1/probe-log/nope').set('Cookie', cookies).expect(404);
    const logs = await prisma.accessLog.findMany({ where: { campaignId }, orderBy: { at: 'asc' } });
    expect(logs.map((l) => [l.resource, l.resourceId, l.outcome, l.role])).toEqual([
      ['supporter', 'abc', 'OK', 'CANDIDATO'],
      ['supporter', 'nope', 'DENIED', 'CANDIDATO'],
    ]);
  });
});
