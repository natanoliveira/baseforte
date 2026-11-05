# Tasks — BaseForte MVP

Base: `spec.md` + `plan.md`. `[P]` = paralelo. `dep` = depende de. Pronto = critério verificável; toda tarefa de API nasce com teste Jest (TDD) e passa lint+typecheck. Marcar `[x]` ao concluir.

## F1-A Fundação
- [x] **T01** Monorepo | RF-01 | `package.json` (workspaces), `tsconfig.base.json`, `packages/shared/{package.json,src/index.ts}` (enum Role, Plan, Status) | Pronto: `npm i` e `npm run build -w packages/shared` ok | dep —
- [x] **T02** Docker + Makefile | RF-01 | `docker-compose.yml` (postgis/postgis:16, redis, api, web), `Makefile` (`demo`, `tiles`, `test`), `.env.example` | Pronto: `docker compose up db redis` saudável | dep T01
- [x] **T03** API bootstrap | RF-01 | `api/src/{main.ts,app.module.ts}`, `api/src/common/{config.ts,error.filter.ts,pagination.ts}` | Pronto: `/api/v1/health` 200; boot falha sem `APP_ENC_KEY`; erro padrão `{statusCode,code,message}` | dep T01
- [x] **T04** Prisma + migrations F1 | modelo §3 | `api/prisma/schema.prisma`, `api/prisma/migrations/{M1,M2,M3}` (postgis, pgcrypto, GiST) | Pronto: `prisma migrate deploy` no banco limpo cria tudo; `mapPoint` presente | dep T02,T03
- [x] **T05** Tenancy | RF-02, RN-02 | `api/src/tenancy/{cls.module.ts,tenant.extension.ts,tenant.guard.ts}` + teste que varre todos os modelos com `campaignId` | Pronto: CA-01 (404 cruzado); modelo sem `campaignId` falha o teste | dep T04
- [x] **T06** Auth | RF-03, RN-04 | `api/src/auth/{auth.controller.ts,auth.service.ts,jwt.guard.ts}` | Pronto: login/refresh/logout/me; cookie httpOnly; senha argon2 | dep T05
- [x] **T07** RBAC + Scope | RF-04, RN-05, RN-25 | `api/src/common/{roles.decorator.ts,roles.guard.ts}`, `api/src/tenancy/scope.service.ts` | Pronto: matriz §5 testada por papel; escopo região/subárvore/próprio | dep T06
- [x] **T08** Usuários + planos | RF-05, RN-03 | `api/src/users/{users.controller.ts,users.service.ts}`, `plan-limit.service.ts` | Pronto: CA-05 (403 `PLAN_LIMIT_REACHED`) | dep T07
- [x] **T09** Regiões/bairros | RN-07, CB-07 | `api/src/regions/{regions.controller.ts,regions.service.ts}` | Pronto: listar com GeoJSON; mudar região de bairro altera escopo imediato (CB-07) | dep T07

## F1-B Pirâmide + LGPD + dados
- [x] **T10** Dados sensíveis + Geo | RF-19, RN-15, P-05, P-06 | `api/src/common/{sensitive-data.service.ts,geo.repository.ts,jitter.ts}` + `jitter.spec.ts` | Pronto: CA-15 (dump ilegível sem chave); jitter ≤200 m e determinístico | dep T04 [P]
- [x] **T11** AccessLog | RF-20, RN-16 | `api/src/common/{access-log.service.ts,access-log.interceptor.ts}` | Pronto: CA-16 | dep T07 [P]
- [x] **T12** Lideranças CRUD + status | RF-06, RF-08, RN-10 | `api/src/leaders/{leaders.controller.ts,leaders.service.ts,status.util.ts}` | Pronto: CA-07 (14/45 dias, override); limite de plano aplicado | dep T07,T10
- [x] **T13** Árvore + mover | RF-07, RN-09, CB-01 | `api/src/leaders/{tree.service.ts}` (CTE recursiva, anti-ciclo, transação+log) | Pronto: CA-06; ciclo → 422 | dep T12
- [x] **T14** Ranking | RF-09, RN-11 | `api/src/leaders/ranking.service.ts` | Pronto: score 0,6/0,4; meta conta só consentimento ativo (OQ-02) | dep T12 [P]
- [x] **T15** Apoiadores | RF-10, RN-08, RN-14, CB-05, CB-10 | `api/src/supporters/{supporters.controller.ts,supporters.service.ts}` | Pronto: CA-02, CA-04, CA-11; detalhe loga acesso; sem consentimento → 422; telefone duplicado → alerta | dep T10,T11,T12
- [x] **T16** Consentimento | RF-21, RN-17 | `api/src/consent/{consent.controller.ts,consent.service.ts}` | Pronto: versão do texto, conceder/revogar; consentimento criado na mesma transação do apoiador | dep T15
- [x] **T17** Lista de comunicação | RF-21, RN-20 | `api/src/consent/communication.controller.ts` | Pronto: CA-12; só `wa.me` individual, sem envio automático | dep T16
- [x] **T18** Descadastro | RF-22, RN-18, CB-04 | `api/src/privacy/{removal.controller.ts,removal.service.ts}` (público por token) | Pronto: CA-13 idempotente, 1 log, `RemovalRecord` | dep T16
- [x] **T19** DPO + ROPA + auditor | RF-23, RF-26, RN-21 | `api/src/privacy/{dpo.controller.ts,ropa.service.ts,audit.controller.ts}` | Pronto: ROPA CSV+PDF; CA-17 | dep T11,T16
- [x] **T20** Encerrar campanha | RF-24, RN-19, CB-08 | `api/src/privacy/close-campaign.service.ts`, `campaign-closed.guard.ts` | Pronto: CA-14; escritas bloqueadas depois (`CAMPAIGN_CLOSED`) | dep T18
- [x] **T21** Geocodificação | RF-18, RN-23, CB-02 | `api/src/geocode/{geocode.controller.ts,geocode.processor.ts,nominatim.client.ts}` | Pronto: fila 1 job/s, cache hit sem chamada externa, falha → `geocodeStatus=FAILED`; teste com cliente mockado | dep T10,T15
- [x] **T22** Fixtures | RF-38, RN-24, R-06 | `api/fixtures/{neighborhoods.geojson,voting-places.json}` | Pronto: 15 bairros fictícios válidos, ~40 locais, sem nomes reais de pessoas/partidos | dep T01 [P]
- [x] **T23** Seed F1 | RF-38, RN-01 | `api/prisma/seed.ts`, `api/prisma/seed-data/*.ts` | Pronto: 1+4+40+~1.500, 3 bairros vazios, 2 acima da meta, consentimentos 100%, telefones `(86) 90000-0000`, idempotente | dep T15,T16,T22

## F1-C Mapa + telas
- [x] **T24** Mapa API | RF-11–15, RN-12–14, CB-03 | `api/src/map/{map.controller.ts,map.service.ts}`, `api/src/regions/panel.service.ts` | Pronto: CA-03, CA-08, CA-09 (meta 0 → `null`); resposta nunca contém coordenada exata | dep T15,T22
- [x] **T25** Relatório PDF bairro | RF-16 | `api/src/map/report.service.ts` | Pronto: PDF baixa com lideranças/apoiadores/lacunas, sem dado sensível | dep T24
- [ ] **T26** Web shell | RF-03, RF-25 | porta 3006 (`next dev -p 3006`, baseURL do Playwright) | `web/` init (Next 14, Tailwind, shadcn), `web/src/app/{(auth)/login,(app)/layout.tsx}`, `web/middleware.ts`, `web/src/lib/api.ts` | Pronto: login funcional; banner "não substitui orientação jurídica eleitoral" em todas as telas autenticadas | dep T06 [P]
- [ ] **T27** Mapa base web | RF-17, RN-24 | `web/src/components/map/{MapView.tsx,style.ts}`, `web/public/map/fallback-style.json` | Pronto: CA-10 (offline carrega bairros); protocolo `pmtiles://` se arquivo existir | dep T26
- [ ] **T28** Camadas do mapa | RF-11, RF-13 | `web/src/components/map/layers/{pins,cluster,heatmap,choropleth,gaps,voting}.ts` | Pronto: CA-09; vazios destacados; toggles por camada | dep T27,T24
- [ ] **T29** Filtros, painel, export | RF-12, RF-14, RF-16 | `web/src/app/(app)/mapa/page.tsx`, `web/src/components/map/{Filters,NeighborhoodPanel,ExportButtons}.tsx` | Pronto: filtros coordenador/bairro/status/meta; PNG e PDF baixam | dep T28,T25
- [ ] **T30** Telas de lideranças | RF-06, RF-07, RF-09 | `web/src/app/(app)/liderancas/{page,[id]/page}.tsx`, `web/src/components/OrgChart.tsx` (dnd-kit) | Pronto: arrastar reatribui e persiste; ranking visível | dep T26,T13,T14
- [ ] **T31** Telas de apoiadores | RF-10, RF-21 | `web/src/app/(app)/apoiadores/{page,novo/page}.tsx`, `ConsentForm.tsx` | Pronto: sem consentimento não salva; clicar no mapa posiciona (fallback); botão `wa.me` só para consentidos; endereço só aparece para papéis autorizados | dep T26,T15,T17
- [ ] **T32** Telas LGPD | RF-22–24, RF-26 | `web/src/app/(app)/privacidade/*`, `web/src/app/remover-dados/[token]/page.tsx` | Pronto: DPO editável, export ROPA, auditor lê logs, encerrar com 2 confirmações, descadastro público em 1 clique | dep T26,T19,T20

## F1-D Qualidade
- [ ] **T33** Jest transversal | RF-39 | `api/test/{tenant,rbac,map-privacy,consent}.e2e-spec.ts` | Pronto: CA-01–04, CA-11–13, CA-17 verdes; liderança A não vê apoiadores de B | dep T24,T18,T19
- [ ] **T34** Playwright | RF-39, CA-18/19/10 | `web/e2e/{map-flow,rbac-lideranca,offline,descadastro}.spec.ts`, `web/playwright.config.ts` | Pronto: login→mapa→filtrar bairro→abrir liderança; liderança só vê a própria base; offline; descadastro remove das listas e gera log | dep T29,T30,T32,T23
- [ ] **T35** Lint/typecheck | RF-39 | `.eslintrc.cjs`, `.prettierrc`, scripts `lint`/`typecheck` nos workspaces | Pronto: zero erros em api, web, shared | dep T01
- [ ] **T36** README | RF-40 | `README.md` (Mermaid, passo a passo, "Conformidade LGPD/TSE" com analogia, nota sobre `APP_ENC_KEY` e bairros ilustrativos) | Pronto: revisão manual contra RN-18–22 | dep T34
- [ ] **T37** Verificação final F1 | CA-18, critérios 1–6 de init.md | rodar do zero `docker compose up` + `make demo`, conferir os 6 critérios, gerar `TODO.md` | Pronto: checklist assinado, todos os testes passam | dep T33–T36

## F2 Agenda, visitas e demandas
- [ ] **T40** Eventos | RF-27 | `api/src/events/*` | Pronto: CRUD com escopo por papel; auditor 403 | dep T07,T12
- [ ] **T41** Visitas + check-in | RF-28, CB-09 | `api/src/visits/*` | Pronto: CA-25 (`verified=false` sem geo); atualiza `lastActivityAt` (RN-10) | dep T40
- [ ] **T42** Rota do dia | RF-29, RN-28 | `api/src/visits/route.util.ts` + spec | Pronto: CA-20 determinístico | dep T41 [P]
- [ ] **T43** Uploads | P-15 | `api/src/common/uploads/*` | Pronto: valida tipo/tamanho; servido por endpoint com checagem de tenant | dep T07 [P]
- [ ] **T44** Demandas API | RF-30, RF-31, RN-26 | `api/src/demands/*`, migration M4 | Pronto: CA-21; pin com mesma regra de privacidade | dep T43,T10
- [ ] **T45** Web agenda + PWA | RF-27–29 | `web/src/app/(app)/agenda/*`, `web/public/{manifest.json,sw.js}` | Pronto: instalável; check-in usa geolocalização; rota do dia exibida | dep T41,T42,T26
- [ ] **T46** Web demandas + camada | RF-30, RF-31 | `web/src/app/(app)/demandas/*`, `web/src/components/map/layers/demands.ts` | Pronto: fluxo de status; retorno obrigatório ao resolver | dep T44,T28
- [ ] **T47** Seed F2 | RF-38 | `api/prisma/seed-data/{demands,events}.ts` | Pronto: 60 demandas + 20 eventos, idempotente | dep T44,T40
- [ ] **T48** e2e completo | CA-19 | `web/e2e/map-flow.spec.ts` (acrescenta "registrar visita") | Pronto: fluxo completo do init.md verde | dep T45,T47

## F3 Materiais, financeiro, mandato
- [ ] **T50** Materiais + entregas | RF-32 | `api/src/materials/*`, migration M5 | Pronto: CA-22 (409 `STOCK_INSUFFICIENT`); Coord-região só sua região | dep T07
- [ ] **T51** Voluntários | RF-33 | `api/src/volunteers/*` | Pronto: escala por evento sem conflito de horário do mesmo voluntário | dep T40 [P]
- [ ] **T52** Financeiro API | RF-34, RF-35, RN-27 | `api/src/finance/*`, `validators/doc.ts` | Pronto: CA-23, CA-24; só Candidato/Coord-geral | dep T07,T43
- [ ] **T53** Export CSV | RF-36 | `api/src/finance/export.service.ts` | Pronto: CSV + texto do aviso TSE | dep T52
- [ ] **T54** Modo mandato | RF-37, RN-29 | `api/src/campaign/mode.service.ts`, `web/src/lib/mode.ts` | Pronto: conforme OQ-03 (esconde financeiro/metas/ranking, rótulo "Cidadão") | dep T52
- [ ] **T55** Web materiais/voluntários | RF-32, RF-33 | `web/src/app/(app)/{materiais,voluntarios}/*` | Pronto: telas com escopo por papel | dep T50,T51 [P]
- [ ] **T56** Web financeiro | RF-34–36 | `web/src/app/(app)/financeiro/*` | Pronto: alertas 80/100%, aviso do TSE visível, export CSV | dep T52,T53 [P]
- [ ] **T57** Seed F3 | RF-38 | `api/prisma/seed-data/{finance,materials}.ts` | Pronto: 50 lançamentos | dep T52,T50
- [ ] **T58** Verificação final F2/F3 | todos | e2e + README atualizado + `TODO.md` | Pronto: testes verdes, critérios conferidos | dep T48,T54–T57

## Checagem de cobertura
- **RF → tarefa:** RF-01 T01–02 · 02 T05 · 03 T06,T26 · 04 T07 · 05 T08 · 06 T12,T30 · 07 T13,T30 · 08 T12 · 09 T14,T30 · 10 T15,T31 · 11 T24,T28 · 12 T24,T29 · 13 T24,T28 · 14 T24,T29 · 15 T24 · 16 T25,T29 · 17 T27 · 18 T21 · 19 T10 · 20 T11 · 21 T16,T17,T31 · 22 T18,T32 · 23 T19,T32 · 24 T20,T32 · 25 T26 · 26 T19,T32 · 27 T40 · 28 T41 · 29 T42 · 30–31 T44 · 32 T50 · 33 T51 · 34–35 T52 · 36 T53 · 37 T54 · 38 T23,T47,T57 · 39 T33–35 · 40 T36. **Todos cobertos.**
- **CA → tarefa:** 01 T05,T33 · 02 T15,T33 · 03 T24,T33 · 04 T15 · 05 T08 · 06 T13 · 07 T12 · 08 T24,T34 · 09 T24,T28 · 10 T27,T34 · 11 T15 · 12 T17 · 13 T18 · 14 T20 · 15 T10 · 16 T11 · 17 T19 · 18 T37 · 19 T34,T48 · 20 T42 · 21 T44 · 22 T50 · 23–24 T52 · 25 T41. **Todos cobertos.**
- **CB → tarefa:** 01 T13 · 02 T21 · 03 T24 · 04 T18 · 05 T15 · 07 T09 · 08 T20 · 09 T41 · 10 T15.
- CB-06 removido (D-12): sem lacunas.
