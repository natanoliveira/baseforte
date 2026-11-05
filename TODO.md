# TODO BaseForte

Fonte: `docs/specs/baseforte-mvp/tasks.md` (marcar `[x]` lá ao concluir). Estado: **T01–T25 prontos** (backend F1).

## Antes de continuar
- [ ] Code review do diff atual (opus: toca auth, schema/migrations e >300 linhas)
- [ ] Rodar `/cartographer` (mudança estrutural grande: monorepo novo) e `graphify update .` se houver grafo
- [ ] Ambiente: `docker compose up -d db redis` (Postgres 5433, Redis 6380); `.env` a partir de `.env.example`; `npx prisma migrate deploy && npx prisma db seed` em `api/`

## F1: telas e qualidade
- [ ] T26 Web shell (Next 14, Tailwind, shadcn, porta 3006, login, middleware, banner jurídico) — dep T06
- [ ] T27 Mapa base web (MapLibre, estilo online/fallback offline, `fallback-style.json`, PMTiles) — dep T26
- [ ] T28 Camadas do mapa (pins, cluster, calor, coroplético, vazios, locais de votação) — dep T27
- [ ] T29 Filtros, painel lateral e export PNG/PDF — dep T28
- [ ] T30 Telas de lideranças (lista, ranking, organograma com dnd-kit) — dep T26
- [ ] T31 Telas de apoiadores (form com consentimento, clique no mapa, `wa.me`) — dep T26
- [ ] T32 Telas LGPD (DPO, ROPA, auditor, encerrar campanha, `/remover-dados/[token]`) — dep T26
- [ ] T33 Jest transversal (tenant, RBAC, privacidade do mapa, consentimento)
- [ ] T34 Playwright (login → mapa → filtrar bairro → abrir liderança; liderança vê só a própria base; offline; descadastro)
- [ ] T35 ESLint/Prettier: instalado mas **sem config**, `npm run lint` ainda falha
- [ ] T36 README pt-BR (Mermaid, capítulo "Conformidade LGPD/TSE" com analogia, `APP_ENC_KEY`, bairros ilustrativos, senha do seed)
- [ ] T37 Verificação final F1 do zero (`docker compose up` + `make demo`) e critérios 1–6 do `init.md`
- [ ] `api/Dockerfile` e `web/Dockerfile` (hoje só `db` e `redis` foram validados no compose)
- [ ] `make tiles`: validar o comando `pmtiles extract` (bbox de Teresina) com rede

## F2: agenda, visitas e demandas
- [ ] T40 Eventos · T41 Visitas + check-in · T42 Rota do dia · T43 Uploads · T44 Demandas API (+ migration M4)
- [ ] T45 Web agenda + PWA · T46 Web demandas + camada no mapa · T47 Seed F2 (60 demandas, 20 eventos) · T48 e2e completo (registrar visita)
- [ ] Painel do bairro (`requests: []`) passa a listar demandas

## F3: materiais, financeiro e mandato
- [ ] T50 Materiais + entregas (M5) · T51 Voluntários · T52 Financeiro API · T53 Export CSV (aviso TSE) · T54 Modo mandato (OQ-03)
- [ ] T55 Web materiais/voluntários · T56 Web financeiro · T57 Seed F3 (50 lançamentos) · T58 Verificação final F2/F3

## Notas e decisões em aberto
- OQ-01, OQ-02 e OQ-03 seguiram as propostas do `analysis.md`; reabrir se mudar.
- Sem rate limit no login e no endpoint público de descadastro (token UUID); considerar antes de produção.
- Testes e2e da API precisam do Postgres e do Redis no ar.
- Preview do design system: `previews/design-system.html`; fluxos: `previews/fluxos.html` (fonte: `docs/specs/baseforte-mvp/diagramas.md`).
