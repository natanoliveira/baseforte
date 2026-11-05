import { Prisma } from '@prisma/client';

export const GLOBAL_MODELS = ['Campaign', 'GeocodeCache'];

export const TENANT_MODELS = new Set(
  Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === 'campaignId')).map((m) => m.name),
);

const WHERE_OPS = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow',
  'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy',
]);

// Convenção: create/createMany usam FKs escalares (input "unchecked"), nunca `connect`.
export function tenantExtension(getCampaignId: () => string) {
  return Prisma.defineExtension({
    name: 'tenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const campaignId = getCampaignId();
          const a: any = args ?? {};
          if (WHERE_OPS.has(operation)) {
            a.where = { ...a.where, campaignId };
          } else if (operation === 'create') {
            a.data = { ...a.data, campaignId };
          } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
            a.data = Array.isArray(a.data)
              ? a.data.map((d: any) => ({ ...d, campaignId }))
              : { ...a.data, campaignId };
          } else if (operation === 'upsert') {
            a.where = { ...a.where, campaignId };
            a.create = { ...a.create, campaignId };
          }
          return query(a);
        },
      },
    },
  });
}
