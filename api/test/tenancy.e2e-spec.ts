import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { TenancyModule } from '../src/tenancy/tenancy.module';
import { PrismaService } from '../src/tenancy/prisma.service';

describe('isolamento de tenant (CA-01)', () => {
  let prisma: PrismaService;
  let cls: ClsService;
  let a: string;
  let b: string;
  const slug = () => `t-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [TenancyModule] }).compile();
    await mod.init();
    prisma = mod.get(PrismaService);
    cls = mod.get(ClsService);
    a = (await prisma.campaign.create({ data: { slug: slug(), name: 'A' } })).id;
    b = (await prisma.campaign.create({ data: { slug: slug(), name: 'B' } })).id;
  });

  afterAll(async () => {
    await prisma.region.deleteMany({ where: { campaignId: { in: [a, b] } } });
    await prisma.campaign.deleteMany({ where: { id: { in: [a, b] } } });
    await prisma.$disconnect();
  });

  const as = <T>(campaignId: string, fn: () => PromiseLike<T>) =>
    cls.run(async () => { cls.set('campaignId', campaignId); return await fn(); });

  it('create injeta campaignId e ignora o do chamador', async () => {
    const r = await as(a, () => prisma.tenant.region.create({ data: { name: 'R1', campaignId: b } as any }));
    expect(r.campaignId).toBe(a);
  });

  it('A não lê, edita nem apaga dados de B', async () => {
    const rb = await as(b, () => prisma.tenant.region.create({ data: { name: 'RB' } as any }));
    expect(await as(a, () => prisma.tenant.region.findFirst({ where: { id: rb.id } }))).toBeNull();
    expect(await as(a, () => prisma.tenant.region.findMany())).toHaveLength(1);
    expect((await as(a, () => prisma.tenant.region.updateMany({ where: { id: rb.id }, data: { name: 'x' } }))).count).toBe(0);
    expect((await as(a, () => prisma.tenant.region.deleteMany({ where: { id: rb.id } }))).count).toBe(0);
    expect(await as(b, () => prisma.tenant.region.count())).toBe(1);
  });

  it('sem contexto de tenant, o cliente tenant falha', async () => {
    await expect(cls.run(async () => await prisma.tenant.region.findMany())).rejects.toThrow(/tenant/i);
  });
});
