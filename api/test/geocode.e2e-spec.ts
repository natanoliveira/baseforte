import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { ClsService } from 'nestjs-cls';
import { GeoRepository } from '../src/common/geo.repository';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { GEOCODE_QUEUE, GeocodeProcessor, addressHash } from '../src/geocode/geocode.processor';
import { PrismaService } from '../src/tenancy/prisma.service';

const CONSENT = { channel: 'presencial', purpose: 'comunicacao-campanha', textVersion: 'v1', textAccepted: 'Autorizo contato sobre a campanha.' };

describe('geocodificação (RF-18, RN-23, CB-02)', () => {
  let app: INestApplication, prisma: PrismaService, proc: GeocodeProcessor;
  let campaignId: string, supporterId: string, ck: string[];
  const search = jest.fn();
  const added: any[] = [];
  const stamp = Date.now();
  const addr = `Rua Teste ${stamp}, Teresina`;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getQueueToken(GEOCODE_QUEUE)).useValue({
        add: jest.fn(async (_n: string, data: any) => { added.push(data); return { id: String(added.length) }; }),
        getJob: jest.fn(async (id: string) => (added[Number(id) - 1] ? { data: added[Number(id) - 1], getState: async () => 'waiting' } : null)),
        close: jest.fn(), disconnect: jest.fn(),
      }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService); proc = new GeocodeProcessor(prisma, { search } as any, mod.get(GeoRepository), mod.get(ClsService));
    campaignId = (await prisma.campaign.create({ data: { slug: `gc-${stamp}`, name: 'Geo' } })).id;
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    const nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } })).id;
    const pw = await argon2.hash('pw');
    await prisma.user.create({ data: { campaignId, email: `c-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    const ul = await prisma.user.create({ data: { campaignId, email: `l-${stamp}@exemplo.test`, name: 'L', role: 'LIDERANCA', passwordHash: pw } });
    const l = await prisma.leader.create({ data: { campaignId, userId: ul.id, neighborhoodId: nb, name: 'L' } });
    ck = (await api().post('/api/v1/auth/login').send({ email: `c-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
    supporterId = (await api().post('/api/v1/supporters').set('Cookie', ck).send({ name: 'Ap Geo', neighborhoodId: nb, leaderId: l.id, consent: CONSENT }).expect(201)).body.id;
  });
  afterAll(async () => {
    await prisma.geocodeCache.deleteMany({ where: { queryHash: addressHash(addr) } });
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

  it('POST /geocode responde 202 e enfileira; apoiador fora do escopo → 404', async () => {
    const r = await api().post('/api/v1/geocode').set('Cookie', ck).send({ address: addr, supporterId }).expect(202);
    expect(r.body.jobId).toBe('1');
    expect(added[0]).toMatchObject({ address: addr, supporterId, campaignId });
    await api().post('/api/v1/geocode').set('Cookie', ck).send({ address: addr, supporterId: '00000000-0000-4000-8000-000000000000' }).expect(404);
    const st = await api().get('/api/v1/geocode/jobs/1').set('Cookie', ck).expect(200);
    expect(st.body.state).toBe('waiting');
    await api().get('/api/v1/geocode/jobs/99').set('Cookie', ck).expect(404);
  });

  it('processor: consulta uma vez, grava cache e posiciona o apoiador com jitter', async () => {
    search.mockResolvedValueOnce({ lat: -5.0892, lng: -42.8019 });
    const r1 = await proc.process({ data: added[0] } as any);
    expect(r1).toEqual({ status: 'OK', cached: false });
    const [row] = await prisma.$queryRaw<any[]>`SELECT "geocodeStatus", "mapPoint" IS NOT NULL p FROM "Supporter" WHERE id = ${supporterId}`;
    expect(row).toEqual({ geocodeStatus: 'OK', p: true });

    const r2 = await proc.process({ data: added[0] } as any);
    expect(r2.cached).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('CB-02: endereço não encontrado ou erro do serviço → FAILED, sem posição', async () => {
    await prisma.$executeRaw`UPDATE "Supporter" SET "mapPoint" = NULL, "geocodeStatus" = 'PENDING' WHERE id = ${supporterId}`;
    search.mockResolvedValueOnce(null);
    const r = await proc.process({ data: { address: `Inexistente ${stamp}`, supporterId, campaignId } } as any);
    expect(r.status).toBe('FAILED');
    expect((await prisma.supporter.findUniqueOrThrow({ where: { id: supporterId } })).geocodeStatus).toBe('FAILED');
    search.mockRejectedValueOnce(new Error('rede'));
    expect((await proc.process({ data: { address: `Erro rede ${stamp}`, supporterId, campaignId } } as any)).status).toBe('FAILED');
    await prisma.geocodeCache.deleteMany({ where: { queryHash: { in: [addressHash(`Inexistente ${stamp}`)] } } });
  });
});
