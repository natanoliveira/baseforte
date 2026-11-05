import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { Roles } from '../src/common/roles.decorator';
import { PrismaService } from '../src/tenancy/prisma.service';
import { ScopeService } from '../src/tenancy/scope.service';
import { ClsService } from 'nestjs-cls';

@Controller('rbac-probe')
class ProbeController {
  @Get('open') @Roles('CANDIDATO', 'AUDITOR') open() { return { ok: true }; }
  @Get('closed') @Roles('CANDIDATO') closed() { return { ok: true }; }
  @Get('unannotated') unannotated() { return { ok: true }; }
}

describe('RBAC + escopo (RF-04)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scope: ScopeService;
  let cls: ClsService;
  let campaignId: string;
  const ids: Record<string, string> = {};
  const stamp = Date.now();
  const emailOf = (k: string) => `${k}-${stamp}@exemplo.test`;

  async function mkUser(key: string, role: any, extra: any = {}) {
    const u = await prisma.user.create({
      data: { campaignId, email: emailOf(key), name: key, role, passwordHash: await argon2.hash('pw'), ...extra },
    });
    ids[key] = u.id;
    return u;
  }
  async function mkLeader(key: string, userId: string, neighborhoodId: string, parentId?: string) {
    const l = await prisma.leader.create({ data: { campaignId, userId, neighborhoodId, name: key, parentId } });
    ids[key] = l.id;
    return l;
  }
  const asRole = <T>(store: any, fn: () => PromiseLike<T>) =>
    cls.run(async () => { Object.entries(store).forEach(([k, v]) => cls.set(k as any, v as any)); return await fn(); });
  async function login(key: string) {
    const r = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: emailOf(key), password: 'pw' });
    return r.headers['set-cookie'] as unknown as string[];
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule], controllers: [ProbeController] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = mod.get(PrismaService);
    scope = mod.get(ScopeService);
    cls = mod.get(ClsService);
    campaignId = (await prisma.campaign.create({ data: { slug: `r-${stamp}`, name: 'RBAC' } })).id;
    const r1 = await prisma.region.create({ data: { campaignId, name: 'R1' } });
    const r2 = await prisma.region.create({ data: { campaignId, name: 'R2' } });
    const n1 = await prisma.neighborhood.create({ data: { campaignId, regionId: r1.id, name: 'N1' } });
    const n2 = await prisma.neighborhood.create({ data: { campaignId, regionId: r2.id, name: 'N2' } });
    ids.r1 = r1.id; ids.n1 = n1.id; ids.n2 = n2.id;
    await mkUser('cand', 'CANDIDATO');
    await mkUser('aud', 'AUDITOR');
    await mkUser('creg', 'COORD_REGIAO', { regionId: r1.id });
    const uA = await mkUser('uA', 'LIDERANCA');
    const uB = await mkUser('uB', 'LIDERANCA');
    const uA2 = await mkUser('uA2', 'LIDERANCA');
    await mkLeader('lA', uA.id, n1.id);
    await mkLeader('lA2', uA2.id, n1.id, ids.lA);
    await mkLeader('lB', uB.id, n2.id);
    for (const [k, leaderId, nid] of [['sA', ids.lA, n1.id], ['sA2', ids.lA2, n1.id], ['sB', ids.lB, n2.id]] as const) {
      ids[k] = (await prisma.supporter.create({ data: { campaignId, leaderId, neighborhoodId: nid, name: k, jitterSeed: 1 } })).id;
    }
  });

  afterAll(async () => {
    await prisma.supporter.deleteMany({ where: { campaignId } });
    await prisma.leader.deleteMany({ where: { campaignId, parentId: { not: null } } });
    await prisma.leader.deleteMany({ where: { campaignId } });
    await prisma.user.deleteMany({ where: { campaignId } });
    await prisma.neighborhood.deleteMany({ where: { campaignId } });
    await prisma.region.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await app.close();
  });

  it('@Roles permite/nega e rota sem @Roles é negada (fail-closed)', async () => {
    const c = await login('cand'), a = await login('aud');
    const get = (p: string, ck: string[]) => request(app.getHttpServer()).get(`/api/v1/rbac-probe/${p}`).set('Cookie', ck);
    await get('open', c).expect(200);
    await get('open', a).expect(200);
    await get('closed', c).expect(200);
    await get('closed', a).expect(403);
    await get('unannotated', c).expect(403);
  });

  it('liderança A vê só a sua subárvore; B fica fora', async () => {
    const store = { campaignId, role: 'LIDERANCA', leaderId: ids.lA };
    const sup = await asRole(store, async () => prisma.tenant.supporter.findMany({ where: await scope.supporterWhere() }));
    expect(sup.map((s) => s.name).sort()).toEqual(['sA', 'sA2']);
    const ld = await asRole(store, async () => prisma.tenant.leader.findMany({ where: await scope.leaderWhere() }));
    expect(ld.map((l) => l.name).sort()).toEqual(['lA', 'lA2']);
  });

  it('coord de região vê só a própria região; candidato vê tudo; auditor é negado', async () => {
    const reg = await asRole({ campaignId, role: 'COORD_REGIAO', regionId: ids.r1 }, async () =>
      prisma.tenant.supporter.findMany({ where: await scope.supporterWhere() }));
    expect(reg.map((s) => s.name).sort()).toEqual(['sA', 'sA2']);
    const all = await asRole({ campaignId, role: 'CANDIDATO' }, async () =>
      prisma.tenant.supporter.findMany({ where: await scope.supporterWhere() }));
    expect(all).toHaveLength(3);
    await expect(asRole({ campaignId, role: 'AUDITOR' }, () => scope.supporterWhere())).rejects.toThrow(/Forbidden/);
  });
});
