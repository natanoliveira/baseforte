import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/tenancy/prisma.service';

describe('ranking (RF-09, OQ-02)', () => {
  let app: INestApplication, prisma: PrismaService, campaignId: string, cookies: string[];
  const stamp = Date.now();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    prisma = mod.get(PrismaService);
    campaignId = (await prisma.campaign.create({ data: { slug: `k-${stamp}`, name: 'Rank' } })).id;
    const reg = await prisma.region.create({ data: { campaignId, name: 'R' } });
    const nb = (await prisma.neighborhood.create({ data: { campaignId, regionId: reg.id, name: 'N' } })).id;
    const pw = await argon2.hash('pw');
    const cand = await prisma.user.create({ data: { campaignId, email: `c-${stamp}@exemplo.test`, name: 'C', role: 'CANDIDATO', passwordHash: pw } });
    const mk = async (k: string, goal: number, withConsent: number, withoutConsent = 0) => {
      const u = await prisma.user.create({ data: { campaignId, email: `${k}-${stamp}@exemplo.test`, name: k, role: 'LIDERANCA', passwordHash: pw } });
      const l = await prisma.leader.create({ data: { campaignId, userId: u.id, neighborhoodId: nb, name: k, goal } });
      for (let i = 0; i < withConsent + withoutConsent; i++) {
        const s = await prisma.supporter.create({ data: { campaignId, leaderId: l.id, neighborhoodId: nb, name: `${k}${i}`, jitterSeed: i } });
        if (i < withConsent) await prisma.consent.create({ data: { campaignId, supporterId: s.id, channel: 'presencial', purpose: 'comunicacao', textVersion: 'v1', textAccepted: 't', collectedById: cand.id } });
      }
    };
    await mk('alta', 4, 4);
    await mk('meio', 4, 2);
    await mk('semconsent', 4, 0, 4);
    cookies = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: `c-${stamp}@exemplo.test`, password: 'pw' })).headers['set-cookie'] as unknown as string[];
  });
  afterAll(async () => {
    await prisma.consent.deleteMany({ where: { campaignId } });
    await prisma.supporter.deleteMany({ where: { campaignId } });
    await prisma.leader.deleteMany({ where: { campaignId } });
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.neighborhood.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  it('ordena por score e ignora apoiadores sem consentimento ativo', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/leaders/ranking').set('Cookie', cookies).expect(200);
    expect(r.body.map((x: any) => [x.rank, x.name, x.supporters, x.goalPct])).toEqual([
      [1, 'alta', 4, 100], [2, 'meio', 2, 50], [3, 'semconsent', 0, 0],
    ]);
  });
});
