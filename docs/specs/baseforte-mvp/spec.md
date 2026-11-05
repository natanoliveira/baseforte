# Spec — BaseForte MVP

Base: `analysis.md` (RN-xx, CB-xx, OQ-xx). Fase entre colchetes.

## 1. Requisitos funcionais

### Fundação
- RF-01 [F1] Monorepo `api/` + `web/`, Docker Compose (postgres16+postgis, redis, api, web), `make demo` sobe tudo com seed. (RN-24)
- RF-02 [F1] Multi-tenant: `campaignId` em toda tabela de domínio, `TenantGuard` + filtro automático no Prisma. (RN-02)
- RF-03 [F1] Auth e-mail/senha (argon2), JWT access 15 min + refresh 7 d em cookie httpOnly; logout invalida refresh. (RN-04)
- RF-04 [F1] RBAC por decorator `@Roles()` + policy de escopo (região/subárvore/próprio). (RN-05, RN-25)
- RF-05 [F1] Planos Vereador/Prefeito com limites aplicados na criação de usuário e liderança. (RN-03)

### Pirâmide
- RF-06 [F1] CRUD de lideranças: nome, telefone, bairro, zonas/seções, meta, status, pai na árvore. (RN-06, RN-08)
- RF-07 [F1] Árvore visual com drag-and-drop de reatribuição; move subárvore; log. (RN-09, CB-01)
- RF-08 [F1] Status calculado + override manual. (RN-10)
- RF-09 [F1] Ranking por meta e engajamento. (RN-11)
- RF-10 [F1] CRUD de apoiadores com consentimento obrigatório na criação. (RN-15, RN-17)

### Mapa
- RF-11 [F1] Mapa MapLibre: pins (cor=status, tamanho=nº apoiadores), cluster, calor, coroplético, camada de locais de votação. (RN-12)
- RF-12 [F1] Filtros: coordenador, bairro, status, faixa de meta.
- RF-13 [F1] Bairros vazios destacados. (RN-13, CB-03)
- RF-14 [F1] Painel lateral do bairro: lideranças, apoiadores (contagem), pedidos, lacunas.
- RF-15 [F1] Privacidade: API de mapa só devolve posição com jitter/centróide. (RN-14)
- RF-16 [F1] Exportar mapa PNG e relatório do bairro PDF.
- RF-17 [F1] Fallback offline de basemap; PMTiles via `make tiles`. (RN-24)
- RF-18 [F1] Geocodificação em fila, cache, fallback clicar no mapa. (RN-23, CB-02)

### LGPD
- RF-19 [F1] Criptografia pgcrypto nos campos de RN-15.
- RF-20 [F1] Log de acesso a cadastros. (RN-16)
- RF-21 [F1] Consentimento versionado; listas de comunicação só com consentimento ativo; links `wa.me`. (RN-17, RN-20)
- RF-22 [F1] Descadastro 1 clique + página pública `/remover-dados/:token`. (RN-18, CB-04)
- RF-23 [F1] Página DPO por campanha; export do Registro de Operações de Tratamento (CSV+PDF). (RN-21)
- RF-24 [F1] Encerrar campanha com política e confirmação dupla. (RN-19, CB-08)
- RF-25 [F1] Banner jurídico em todas as telas autenticadas. (RN-22)
- RF-26 [F1] Visão do Auditor: logs e consentimentos, só leitura.

### Agenda e visitas
- RF-27 [F2] Eventos (reunião, caminhada, evento) do candidato e das lideranças.
- RF-28 [F2] Check-in PWA com geolocalização. (CB-09)
- RF-29 [F2] Rota do dia por vizinho-mais-próximo. (RN-28)

### Demandas
- RF-30 [F2] CRUD de demandas com foto, bairro, pin; camada no mapa. (RN-26)
- RF-31 [F2] Fluxo aberta→encaminhada→resolvida; retorno obrigatório ao resolver.

### Materiais e voluntários
- RF-32 [F3] Estoque de materiais e entregas por liderança; saldo nunca negativo.
- RF-33 [F3] Escala de voluntários por evento.

### Financeiro
- RF-34 [F3] Receitas/despesas, categoria, comprovante, fornecedor CNPJ/CPF validado. (RN-27)
- RF-35 [F3] Limite de gastos com alertas 80%/100%.
- RF-36 [F3] CSV de prestação de contas + aviso TSE.

### Mandato
- RF-37 [F3] Toggle campanha→mandato conforme OQ-03. (RN-29)

### Seed e qualidade
- RF-38 [F1] Seed fictício: 1 coord-geral, 4 coord-região, 40 lideranças, ~1.500 apoiadores (telefones `(86) 90000-0000`), 15 bairros (3 vazios, 2 acima da meta), ~40 locais de votação, consentimentos 100%. [F2/F3 acrescentam: 60 demandas, 20 eventos, 50 lançamentos]. (RN-01)
- RF-39 [F1] Testes Jest (RBAC, tenant, consentimento, jitter), Playwright e2e, lint+typecheck limpos.
- RF-40 [F1] README pt-BR com Mermaid e capítulo "Conformidade LGPD/TSE" com analogia.

## 2. Critérios de aceite (dado/quando/então)

- CA-01 (RF-02) Dado usuário da campanha A, quando requisita recurso da campanha B por id, então 404.
- CA-02 (RF-04, RN-08) Dado liderança A e apoiador de liderança B, quando A faz GET no apoiador, então 404 e log `ACCESS_DENIED`.
- CA-03 (RF-15) Dado qualquer papel, quando chama `/map/*`, então nenhuma resposta contém coordenada exata; distância pin↔real ≤ ~200 m e estável entre chamadas.
- CA-04 (RF-15, OQ-01) Dado papel sem permissão, quando pede detalhe do apoiador, então endereço/coordenada vêm `null`.
- CA-05 (RF-05) Dado plano Vereador com 100 lideranças, quando cria a 101ª, então 403 `PLAN_LIMIT_REACHED`.
- CA-06 (RF-07) Dado coordenador de região, quando arrasta liderança com subárvore para outro pai, então todos os descendentes acompanham e há 1 log.
- CA-07 (RF-08) Dado liderança sem atividade há 20 dias, então status = frio; com override "ativo", permanece ativo.
- CA-08 (RF-13) Dado seed, quando abre o mapa, então exatamente 3 bairros vazios destacados.
- CA-09 (RF-11) Dado seed, então clusters, calor e coroplético renderizam; bairro com meta 0 aparece cinza.
- CA-10 (RF-17) Dado rede desligada, quando abre o mapa, então carrega fallback e bairros.
- CA-11 (RF-10) Dado criação de apoiador sem consentimento, então 422.
- CA-12 (RF-21) Dado apoiador sem consentimento ativo, então ele não aparece em nenhuma lista de comunicação nem gera link `wa.me`.
- CA-13 (RF-22) Dado token válido, quando descadastra, então PII anonimizada, fora de todas as listas, 1 log e registro mínimo; repetição → 200 sem novo log (CB-04).
- CA-14 (RF-24) Dado "encerrar campanha", então exige 2 confirmações; aplica a política a todos os apoiadores; irreversível.
- CA-15 (RF-19) Dado dump do banco, então telefone, endereço, coordenada exata e CPF ilegíveis sem `APP_ENC_KEY`.
- CA-16 (RF-20) Dado leitura de cadastro, então 1 linha em `access_log` com usuário, papel, apoiador, ação, timestamp.
- CA-17 (RF-26) Dado auditor, então lê logs/consentimentos e recebe 403 em qualquer escrita e em demais módulos.
- CA-18 (RF-38) Dado `docker compose up` + `make demo`, então login como Candidato em `localhost:3006` mostra o mapa de Teresina.
- CA-19 (RF-39) Playwright: login → mapa → filtrar bairro → abrir liderança → registrar visita passa (visita depende de F2; em F1 o passo é feito até "abrir liderança").
- CA-20 (RF-29) Dado 5 visitas e posição atual, então a ordem segue vizinho-mais-próximo e é determinística.
- CA-21 (RF-31) Dado demanda, ao resolver sem retorno, então 422.
- CA-22 (RF-32) Dado entrega maior que o saldo, então 409.
- CA-23 (RF-35) Dado gastos em 80% e 100% do limite, então alerta correspondente, uma vez por faixa.
- CA-24 (RF-34) Dado CNPJ/CPF inválido, então 422.
- CA-25 (CB-09) Dado check-in sem geolocalização, então registra com `verified=false`.

## 3. Modelo de dados (Prisma, PostgreSQL 16 + PostGIS)

Toda tabela abaixo (exceto `Campaign`) tem `campaignId` + índice. Campos `enc` = `bytea` pgcrypto.

- **Campaign**: id, name, plan(VEREADOR|PREFEITO), mode(CAMPANHA|MANDATO), spendingLimit, retentionPolicy(ANONIMIZAR|APAGAR), closedAt, dpoName, dpoEmail, dpoContact
- **User**: id, campaignId, email(unique), passwordHash, role(CANDIDATO|COORD_GERAL|COORD_REGIAO|LIDERANCA|AUDITOR), name, regionId?, leaderId?
- **Region**: id, campaignId, name
- **Neighborhood**: id, campaignId, regionId, name, geom(MultiPolygon), centroid(Point)
- **Leader**: id, campaignId, userId, parentId (self), neighborhoodId, name, phoneEnc, zones[], sections[], goal, statusOverride?, lastActivityAt
- **Supporter**: id, campaignId, leaderId, neighborhoodId, name, phoneEnc, cpfEnc?, addressEnc, locationEnc (ponto exato), jitterSeed, geocodeStatus(PENDING|OK|FAILED), anonymizedAt?, removalToken(unique)
- **Consent**: id, supporterId, grantedAt, channel, purpose, textVersion, textAccepted, collectedById, revokedAt?
- **AccessLog**: id, campaignId, userId, role, resource, resourceId, action, outcome, at
- **RemovalRecord**: id, campaignId, supporterHash, at, reason
- **VotingPlace**: id, campaignId, name, neighborhoodId, location
- **GeocodeCache**: id, queryHash(unique), lat, lng, at
- **Event** [F2]: id, campaignId, ownerId, type, title, startsAt, endsAt, location, neighborhoodId
- **Visit** [F2]: id, eventId?, leaderId, supporterId?, plannedOrder, checkinAt, checkinLoc?, verified
- **Demand** [F2]: id, campaignId, createdById, neighborhoodId, title, description, photoPath?, locationEnc, status, resolutionNote?, resolvedAt?
- **Material** [F3]: id, campaignId, name, stock; **MaterialDelivery**: materialId, leaderId, qty, at
- **Volunteer/Shift** [F3]: eventId, name, role, slot
- **Transaction** [F3]: id, campaignId, kind(RECEITA|DESPESA), category, amount, date, vendorDoc, vendorName, receiptPath?
- Índices GiST em `geom`, `centroid`, `location`.

## 4. Contratos de API (`/api/v1`, JSON, paginação `?page&pageSize` → `{data,meta:{page,pageSize,total}}`)

Erro padrão: `{statusCode, code, message, details?}`.

- Auth: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- Users: `GET/POST /users`, `PATCH /users/:id`
- Pirâmide: `GET /leaders` (filtros), `POST /leaders`, `GET/PATCH /leaders/:id`, `POST /leaders/:id/move {newParentId}`, `GET /leaders/tree`, `GET /leaders/ranking`
- Apoiadores: `GET/POST /supporters`, `GET /supporters/:id` (detalhe, loga acesso, campos sensíveis condicionais), `PATCH /supporters/:id`, `POST /supporters/:id/consents`, `POST /supporters/:id/revoke`
- Comunicação: `GET /communication/list` (só consentidos), `GET /communication/wa-link/:supporterId`
- Mapa: `GET /map/leaders` (GeoJSON, filtros), `GET /map/heatmap`, `GET /map/choropleth`, `GET /map/voting-places`, `GET /map/gaps`, `GET /neighborhoods/:id/panel`, `GET /neighborhoods/:id/report.pdf`
- Geocodificação: `POST /geocode {address}` → 202 job; `GET /geocode/jobs/:id`
- LGPD: `GET/PUT /privacy/dpo`, `GET /privacy/ropa.(csv|pdf)`, `GET /privacy/consents`, `GET /privacy/access-logs`, `POST /privacy/close-campaign {confirm1, confirm2}`
- Público: `GET /public/dpo/:campaignSlug`, `POST /public/remove-data/:token`
- [F2] `/events`, `/visits`, `/visits/route?lat&lng`, `/demands`, `PATCH /demands/:id/status`
- [F3] `/materials`, `/deliveries`, `/volunteers`, `/finance/transactions`, `/finance/summary`, `/finance/export.csv`, `PATCH /campaign/mode`

Códigos de erro: `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `VALIDATION` 422, `PLAN_LIMIT_REACHED` 403, `CONSENT_REQUIRED` 422, `STOCK_INSUFFICIENT` 409, `CAMPAIGN_CLOSED` 409.

## 5. Matriz de permissões

Legenda: T=tudo, R=região, S=subárvore/próprios, L=só leitura, —=negado.

| Recurso | Candidato | Coord-geral | Coord-região | Liderança | Auditor |
|---|---|---|---|---|---|
| Usuários | T | T | — | — | — |
| Lideranças (ver) | T | T | R | S | — |
| Reatribuir árvore | T | T | R | — | — |
| Apoiadores | T | T | R | S | — |
| Endereço/coord. exata (OQ-01) | T | T | R | S | — |
| Mapa (posição jitter) | T | T | R | S | — |
| Consentimentos / logs | T | T | R (consent.) | — | L |
| Config LGPD / DPO / encerrar | T | T | — | — | — |
| Agenda | T | T | R | S | — |
| Demandas | T | T | R | S (as suas) | — |
| Materiais | T | T | R | S (recebidos) | — |
| Financeiro | T | T | — | — | — |
| Modo mandato | T | T | — | — | — |

## 6. Erros e regras transversais
- Fora de escopo de tenant ou papel de escopo menor → 404; papel sem permissão de módulo → 403.
- Toda escrita em múltiplas tabelas em transação (ex.: apoiador+consentimento, mover subárvore+log, descadastro+RemovalRecord).
- Entidades nunca expostas direto; DTOs com class-validator.
- Descriptografia só em serviço dedicado, nunca em listagens ou mapa.
