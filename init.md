# Projeto: BaseForte — Gestão de lideranças e campanha (apartidário)

## Contexto
Você é um time sênior (tech lead + backend + frontend + GIS + QA + especialista LGPD).
Construa um MVP funcional de gestão de lideranças políticas para candidatos de
QUALQUER partido (produto apartidário: nenhum partido, ideologia ou candidato real
no código, seed ou textos). Foco inicial: eleições municipais (prefeito/vereador).
Interface 100% pt-BR. Cidade demo: Teresina-PI.

Trabalhe em paralelo com subagentes (backend, frontend, mapa/GIS, compliance, testes).
Não pare para pedir confirmação: decida e registre em DECISIONS.md.

## Stack obrigatória
- Monorepo com Docker Compose
- **api/**: NestJS + TypeScript + Prisma + PostgreSQL 16 + **PostGIS**
- **web/**: Next.js 14 (App Router) + React + TypeScript + Tailwind + shadcn/ui
- **Mapa (100% gratuito, sem chave de API)**:
  - MapLibre GL JS
  - Tiles vetoriais: **OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty`)
  - Fallback offline: arquivo **PMTiles** local de Teresina (Protomaps) servido pelo
    próprio app — os testes não podem depender de rede
  - Geocodificação: **Nominatim** com rate limit de 1 req/s, cache no banco e
    User-Agent genérico do app; fallback: o usuário clica no mapa para posicionar
  - Limites de bairros/zonas: GeoJSON em `api/fixtures/` (gere polígonos
    aproximados de ~15 bairros de Teresina se não houver dado real offline)
- Fila: Redis + BullMQ (geocodificação, importações)

## Multi-tenant
- Cada campanha é um tenant isolado (row-level por `campaignId` + guard no Nest)
- Planos: Vereador / Prefeito (limite de usuários e lideranças)

## Papéis (RBAC)
- **Candidato** e **Coordenador-geral**: veem tudo
- **Coordenador de região**: vê só a sua região/bairros
- **Liderança**: vê só os próprios apoiadores e a própria agenda
- **Auditor LGPD**: só leitura de logs e consentimentos

## Funcionalidades

### 1. Pirâmide de lideranças
- Hierarquia: Coordenador-geral → Coordenador de região → Liderança → Apoiador
- Árvore visual (org chart) com drag-and-drop para reatribuir
- Cada liderança tem: nome, telefone, bairro, zona/seção eleitoral de influência,
  meta de apoiadores, status (ativo / frio / inativo)
- Ranking de lideranças por meta atingida e engajamento

### 2. Mapa de lideranças (destaque do produto)
- Pins por liderança com cor por status e tamanho pelo nº de apoiadores
- **Clustering** automático ao afastar o zoom
- **Mapa de calor** da densidade de apoiadores
- **Coroplético por bairro**: % da meta atingida (vermelho → verde)
- Filtros: coordenador, bairro, status, faixa de meta
- Camada de **locais de votação** (seed fictício com ~40 escolas de Teresina)
- Clique no bairro → painel lateral com lideranças, apoiadores, pedidos, lacunas
- Detectar **"vazios"**: bairros sem nenhuma liderança, destacados no mapa
- **Privacidade no mapa**: posição exibida com deslocamento aleatório de ~200 m
  (jitter) ou centróide do bairro — NUNCA o endereço exato da pessoa; o endereço
  completo só aparece para papéis autorizados, no detalhe do cadastro
- Exportar o mapa em PNG e um relatório do bairro em PDF

### 3. Agenda e visitas
- Agenda do candidato e das lideranças (reuniões, caminhadas, eventos)
- Check-in de visita com geolocalização do celular (PWA)
- Rota do dia: ordenar as visitas por proximidade (algoritmo simples, sem API paga)

### 4. Demandas da comunidade
- Registrar pedido ("poste queimado na rua X") com foto, bairro e pin no mapa
- Status: aberta → encaminhada → resolvida; camada própria no mapa
- Ao resolver: registrar o retorno dado ao cidadão

### 5. Materiais e voluntários
- Estoque de materiais (santinhos, adesivos, bandeiras) e entrega por liderança
- Escala de voluntários por evento

### 6. Financeiro da campanha
- Receitas e despesas com categoria, comprovante (upload) e fornecedor (CNPJ/CPF)
- Limite de gastos configurável, com alerta em 80% e 100%
- Exportação em CSV organizada para a prestação de contas (apenas um modelo de
  organização; deixe claro na UI que o envio oficial é feito no sistema do TSE)

### 7. Modo mandato (pós-eleição)
- Toggle "campanha → mandato": a mesma base vira gestão de gabinete
  (demandas do cidadão, agenda, retorno para as lideranças)

## LGPD e regras eleitorais (obrigatório, não opcional)
- Opinião/apoio político = **dado sensível** (LGPD art. 5º, II): criptografia em
  repouso (pgcrypto) nos campos sensíveis, TLS, log de acesso a cada cadastro
- **Consentimento**: cada apoiador tem registro de consentimento (data, canal,
  finalidade, texto aceito, quem coletou). Sem consentimento → não entra em
  nenhuma lista de comunicação
- **Descadastro** em 1 clique e link público de "remover meus dados"
- Página "Encarregado de dados" (DPO) configurável por campanha
- **Registro das Operações de Tratamento** gerado automaticamente (exportável)
- **Proibido no produto**: importar base comprada, raspagem de redes sociais,
  disparo em massa. Comunicação só individual ou para listas com consentimento,
  via links `wa.me` (o usuário envia manualmente) — sem automação de WhatsApp
- **Retenção**: botão "encerrar campanha" que anonimiza ou apaga os apoiadores
  conforme a política configurada, com confirmação dupla
- Banner na UI: "Este sistema não substitui orientação jurídica eleitoral"

## Seed (dados 100% fictícios)
- Campanha demo: "Candidato(a) Exemplo — Vereador(a) — Teresina-PI"
- 1 coordenador-geral, 4 coordenadores de região, 40 lideranças, ~1.500 apoiadores
  (nomes gerados, telefones inválidos do tipo `(86) 90000-0000`)
- 3 bairros propositalmente vazios, 2 bairros acima da meta
- 60 demandas, 20 eventos na agenda, financeiro com 50 lançamentos
- Todos os consentimentos registrados

## Qualidade
- Testes: Jest (api: RBAC, isolamento de tenant, consentimento, jitter do mapa),
  Playwright (login → mapa → filtrar bairro → abrir liderança → registrar visita)
- Teste específico: a liderança A NÃO consegue ver os apoiadores da liderança B
- Teste específico: a API nunca retorna a coordenada exata para papéis sem permissão
- Lint + typecheck sem erros
- README em pt-BR com diagrama Mermaid e um capítulo "Conformidade LGPD/TSE"
  explicado com analogia para leigo
- `docker compose up` + `make demo` sobe tudo com o seed

## Critérios de aceite
1. http://localhost:3000 → login como candidato → mapa de Teresina com clusters,
   mapa de calor e coroplético funcionando
2. Os 3 bairros vazios aparecem destacados
3. O login como liderança mostra só a própria base (RBAC comprovado)
4. O descadastro de um apoiador remove-o de todas as listas e gera um log
5. Mapa e testes funcionam offline (fallback PMTiles)
6. Todos os testes passam

## Ordem de execução
1. Arquitetura, modelo de dados, matriz RBAC → DECISIONS.md
2. Em paralelo: api + PostGIS + RBAC | web + mapa | módulo LGPD | seed
3. Integrar e rodar o e2e, corrigir até passar
4. Revisão final: subir do zero, conferir os critérios de aceite, gerar TODO.md