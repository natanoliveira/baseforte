# BaseForte

Gestão de lideranças e campanha, apartidário, multi-tenant. Specs em `docs/specs/baseforte-mvp/`; pendências em `TODO.md`.

## Padrões da API (`api/`)
- Código de domínio usa `prisma.tenant` (injeta `campaignId` via CLS). `prisma` puro só para login, rotas públicas e jobs. SQL raw filtra `campaignId` à mão.
- `create` usa FKs escalares, nunca `connect`.
- Toda rota autenticada exige `@Roles(...)` (fail-closed); pública usa `@Public()`. Escopo por papel via `ScopeService`.
- PII (telefone, CPF, endereço, coordenada exata) só passa por `SensitiveDataService`. O mapa lê só `mapPoint` (com jitter).
- Cadastro de dado pessoal exige consentimento; descadastro anonimiza e é idempotente.
- Erros no formato `{statusCode, code, message}`; testes e2e precisam de Postgres e Redis no ar.
- Portas: web 3006, API 3001, Postgres 5433, Redis 6380.

## Visão geral do código
Mapa completo em [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md). Stack: NestJS 10 + Prisma 5 + Postgres/PostGIS + Redis/BullMQ (`api/`), Next 14 + Tailwind (`web/`, o browser chama `/api/v1` e o Next reescreve para a API), `packages/shared` (enums, limites de plano).
