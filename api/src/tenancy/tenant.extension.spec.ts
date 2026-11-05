import { Prisma } from '@prisma/client';
import { GLOBAL_MODELS, TENANT_MODELS } from './tenant.extension';

describe('varredura de modelos', () => {
  it('todo modelo tem campaignId ou está na lista global explícita', () => {
    const all = Prisma.dmmf.datamodel.models.map((m) => m.name);
    const orphan = all.filter((m) => !TENANT_MODELS.has(m) && !GLOBAL_MODELS.includes(m));
    expect(orphan).toEqual([]);
  });
});
