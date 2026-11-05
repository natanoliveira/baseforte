# Plan — BaseForte MVP

Base: `spec.md`. Padrões novos (repo vazio); sem `/architecture-designer`: sem decisão estrutural em disputa.

## Decisões técnicas
- P-01 npm workspaces: `api/`, `web/`, `packages/shared` (tipos de papel, enums, DTO de mapa).
- P-02 API: NestJS modular monolith. Módulo por domínio, `controller → service → prisma`. Regra de negócio no service; controller só valida/devolve.
- P-03 Tenant: `nestjs-cls` guarda `{campaignId, userId, role, scope}` por request; Prisma Client Extension injeta `campaignId` em todo `where/create` dos modelos de domínio. Teste garante que modelo sem `campaignId` falha.
- P-04 PostGIS: colunas `Unsupported("geometry(...)")` no Prisma; migrations SQL manuais (`CREATE EXTENSION postgis, pgcrypto`, GiST). Queries espaciais em `$queryRaw` num `GeoRepository`.
- P-05 pgcrypto: `pgp_sym_encrypt/decrypt` só em `SensitiveDataService` (SQL raw). Listagens e mapa nunca chamam decrypt. Coordenada exata criptografada; para o mapa guarda-se `mapPoint` (geometry, já com jitter calculado na escrita) → o mapa nunca toca o dado exato (RN-14).
- P-06 Jitter: ponto exato + offset por PRNG semeado em `jitterSeed` (≤200 m), calculado ao gravar/geocodificar. Estável por construção.
- P-07 Árvore de lideranças: `parentId` + CTE recursiva (`WITH RECURSIVE`) para subárvore/escopo. Mover = update de `parentId` (descendentes acompanham), com checagem anti-ciclo. Leader tem `parentId` (liderança-pai) e `coordinatorId` (User COORD_REGIAO, raiz); mover troca um dos dois.
- P-08 Escopo RBAC: `ScopeService` devolve filtro por papel (todos | bairros da região | ids da subárvore | próprio). Policy única reutilizada por todos os módulos.
- P-09 Filas: BullMQ (`geocode`); worker com limiter 1 job/s. Cache em `GeocodeCache`.
- P-10 Web: Next.js 14 App Router; `middleware.ts` protege rotas; fetch via cliente tipado; TanStack Query. shadcn/ui + Tailwind. Mapa em client component (`dynamic`, ssr:false).
- P-11 Mapa: MapLibre; estilo online OpenFreeMap; offline = estilo local mínimo (`web/public/map/fallback-style.json`) + GeoJSON de bairros servidos pela API. PMTiles via protocolo `pmtiles://` se arquivo existir. Detecção: falha de fetch do estilo → fallback.
- P-12 PDF: `pdfkit` na API (relatório do bairro, ROPA). PNG do mapa: `map.getCanvas().toBlob` (`preserveDrawingBuffer`).
- P-13 PWA: `manifest.json` + service worker mínimo (F2).
- P-14 Testes: Jest + supertest com Postgres PostGIS de teste (docker); Playwright contra stack local com seed e basemap fallback (rede bloqueada).
- P-15 Uploads: volume Docker `/data/uploads`, servido por endpoint autenticado com checagem de tenant.

## Estrutura
```
api/src/{common,auth,tenancy,users,regions,leaders,supporters,consent,privacy,map,geocode,seed(F1),events,visits,demands,materials,volunteers,finance,campaign}
api/prisma/{schema.prisma,migrations/}   api/fixtures/{neighborhoods.geojson,voting-places.json}
web/src/app/{(auth)/login,(app)/{mapa,liderancas,apoiadores,privacidade,...},remover-dados/[token]}
packages/shared   docker-compose.yml   Makefile   README.md
```

## Ordem
1. **F1-A Fundação:** monorepo, Docker, Prisma base + migrations, CLS/tenant, auth, RBAC/scope, planos.
2. **F1-B (paralelo após A):** pirâmide (API) | LGPD (consent, log, descadastro, DPO, ROPA, encerrar) | fixtures+seed | web shell+login.
3. **F1-C:** mapa API → mapa web → árvore web → telas LGPD web.
4. **F1-D:** testes críticos (tenant, RBAC, jitter, consent), e2e, README, `make demo`.
5. **F2:** eventos/visitas/rota → demandas (API+web+PWA) → camada de demandas no mapa.
6. **F3:** materiais/voluntários → financeiro → modo mandato.

## Migrations
- M1 extensões + Campaign/User/Region/Neighborhood; M2 Leader/Supporter/Consent/AccessLog/RemovalRecord/VotingPlace/GeocodeCache; M3 índices GiST + recursive helpers; M4 [F2] Event/Visit/Demand; M5 [F3] Material/Delivery/Volunteer/Transaction. Migration aplicada nunca editada; correção = nova.

## Riscos e mitigação
- R-01 Prisma + geometry: tipos Unsupported → isolar em `GeoRepository`; teste de integração por query.
- R-02 Vazamento de tenant: extension + teste que varre todos os modelos + e2e cruzado.
- R-03 Chave de criptografia perdida = dados irrecuperáveis → documentar no README; `APP_ENC_KEY` obrigatória no boot.
- R-04 Escopo F1 grande → dividir em A/B/C/D com gates de teste.
- R-05 PMTiles real exige rede → fallback GeoJSON mantém testes offline.
- R-06 Polígonos de bairros aproximados (fictícios) → rotular como "ilustrativo" na UI/README.
- R-07 Nominatim ToS → UA genérico, 1 req/s, cache.

## Rollback
- Migrations: `prisma migrate` forward-only; rollback = migration compensatória + restore de backup do volume. Seed idempotente (`make demo` recria do zero). Encerrar campanha é irreversível por design (aviso e confirmação dupla).
