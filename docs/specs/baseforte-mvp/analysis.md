# Análise — BaseForte MVP

Fonte: `init.md`. Repo vazio (greenfield). Rodada 1 de perguntas aprovada com os defaults recomendados.

## Objetivo
MVP multi-tenant e apartidário de gestão de lideranças de campanha municipal (vereador/prefeito), com mapa como destaque e LGPD embutida. UI 100% pt-BR. Demo: Teresina-PI.

## Fases (decisão D-01)
- **F1**: monorepo + Docker + multi-tenant + auth/RBAC + LGPD + pirâmide + mapa + seed + e2e
- **F2**: agenda/visitas (PWA check-in, rota do dia) + demandas
- **F3**: materiais/voluntários + financeiro + modo mandato
- Spec e plan cobrem F1–F3; implementação e tasks seguem a fase.

## Regras de negócio
- RN-01 Apartidário: nenhum partido, ideologia ou candidato real em código, seed ou texto.
- RN-02 Tenant = campanha. Toda tabela de domínio tem `campaignId`; guard Nest injeta e filtra. Acesso cruzado → 404.
- RN-03 Planos: Vereador 60 usuários / 100 lideranças; Prefeito 300 / 1000. Estourar limite → 403 `PLAN_LIMIT_REACHED`.
- RN-04 Usuário pertence a uma campanha só. Login por e-mail+senha, JWT em cookie httpOnly. Sem 2FA/SSO.
- RN-05 Apoiador não tem login; é cadastro.
- RN-06 Hierarquia: Coord-geral → Coord-região → Liderança → Apoiador. Candidato fica acima, sem nó na árvore.
- RN-07 Região = conjunto de bairros; bairro pertence a 1 região. Coord-região tem 1 região.
- RN-08 Liderança tem bairro-base e zonas/seções de influência. Vê só apoiadores que cadastrou ou da sua subárvore. Liderança A nunca vê apoiadores de B.
- RN-09 Reatribuir (drag-and-drop) move a subárvore inteira e grava log.
- RN-10 Status calculado pela última atividade (visita, cadastro de apoiador, evento): ativo ≤14d, frio 15–45d, inativo >45d. Coordenador pode fixar manualmente (override persistente até remover).
- RN-11 Ranking: score = 0,6 × (apoiadores/meta, teto 1) + 0,4 × (atividade 30d normalizada pelo máximo da campanha).
- RN-12 Coroplético: % meta por bairro = Σ apoiadores das lideranças do bairro / Σ metas; escala vermelho→verde.
- RN-13 "Vazio" = bairro sem nenhuma liderança ativa/fria/inativa vinculada; destacado no mapa.
- RN-14 Mapa nunca expõe coordenada exata: pin = posição com jitter ~200 m determinístico por apoiador (seed fixa) ou centróide do bairro. Coordenada/endereço exatos só em endpoint de detalhe, para papéis autorizados (ver OQ-01), e geram log de acesso.
- RN-15 Campos criptografados (pgcrypto, chave `APP_ENC_KEY`): telefone, endereço completo, coordenada exata, CPF. Nome em claro. Existência de cadastro de apoiador = dado sensível (acesso logado).
- RN-16 Log de acesso a cada leitura de cadastro de apoiador (quem, quando, papel, ação).
- RN-17 Consentimento obrigatório por apoiador: data, canal, finalidade, texto aceito, coletor. Sem consentimento ativo → fora de qualquer lista de comunicação.
- RN-18 Descadastro (1 clique + link público por token único): revoga consentimento, anonimiza PII na hora, mantém registro mínimo (hash, data, motivo), gera log, remove de todas as listas.
- RN-19 Encerrar campanha: política configurável (anonimizar | apagar), padrão anonimizar; confirmação dupla; irreversível.
- RN-20 Comunicação só individual ou lista com consentimento, via link `wa.me`; usuário envia manualmente. Proibido: importar base comprada, raspagem, disparo em massa, automação de WhatsApp.
- RN-21 Página DPO configurável por campanha; Registro de Operações de Tratamento gerado automaticamente e exportável.
- RN-22 Banner fixo: "Este sistema não substitui orientação jurídica eleitoral".
- RN-23 Geocodificação: Nominatim via fila BullMQ, 1 req/s, cache no banco, User-Agent genérico; falha → usuário posiciona no mapa.
- RN-24 Offline: fallback de basemap mínimo (GeoJSON de bairros) no repo; PMTiles real via `make tiles` (rede, 1 vez). Testes nunca dependem de rede.
- RN-25 Permissões por módulo: Financeiro só Candidato e Coord-geral; Materiais: Coord-região vê a sua região, Liderança vê o que recebeu; Demandas: Coord-região vê a sua região, Liderança vê as que registrou; Auditor só logs e consentimentos.
- RN-26 Demandas: aberta → encaminhada → resolvida; resolver exige retorno ao cidadão (texto). Foto opcional, bairro obrigatório, pin com a mesma regra de privacidade.
- RN-27 Financeiro: categoria, comprovante, fornecedor (CNPJ/CPF validado); limite de gastos configurável; alertas em 80% e 100%; CSV de prestação de contas com aviso "envio oficial é no sistema do TSE".
- RN-28 Rota do dia: ordena visitas por vizinho-mais-próximo (haversine) a partir da posição atual.
- RN-29 Modo mandato: flag da campanha; mesma base vira gabinete (demandas, agenda, retorno às lideranças). Detalhe em OQ-03.

## Fora de escopo
- Integração oficial TSE, disparo/automação WhatsApp, SSO/2FA, KMS, multi-campanha por usuário, billing real dos planos, app nativo (só PWA).

## Casos de borda
- CB-01 Excluir/mover liderança com subárvore → move subárvore, nunca órfãos.
- CB-02 Apoiador sem coordenada (geocodificação falhou) → fora do mapa/calor, listado como "sem posição".
- CB-03 Bairro com meta total 0 → coroplético "sem meta" (cinza), não divide por zero.
- CB-04 Descadastro duplicado/token reusado → idempotente, 200 sem novo log de anonimização.
- CB-05 Liderança tenta acessar id de apoiador de outra → 404 (não 403) e log.
- CB-06 (removido): importação de apoiadores fora do MVP (D-12).
- CB-07 Troca de região de um bairro → coordenadores afetados perdem/ganham visão imediatamente.
- CB-08 Encerrar campanha com consentimento ativo → política aplicada igualmente a todos.
- CB-09 Check-in fora do raio/sem permissão de geolocalização → registra sem posição, marcado "não verificado".
- CB-10 Mesmo telefone em dois apoiadores → alerta de duplicidade, não bloqueia.

## Decisões tomadas
- D-01 Fases F1/F2/F3.
- D-02 Auth e-mail+senha, JWT httpOnly.
- D-03 Planos 60/100 e 300/1000.
- D-04 Criptografia: telefone, endereço, coordenada exata, CPF.
- D-05 Descadastro anonimiza na hora; encerrar padrão anonimizar.
- D-06 Região 1:N bairros; coord-região 1 região; reatribuição move subárvore.
- D-07 Status calculado 14/45d com override; score 60/40.
- D-08 Matriz de permissões RN-25.
- D-09 PMTiles + fallback GeoJSON; jitter determinístico; Nominatim via BullMQ.
- D-10 `DECISIONS.md` = esta seção.
- D-11 Uploads em volume Docker local (técnico, sem regra de negócio).
- D-13 Limite de usuários do plano conta usuários de equipe (não-Liderança); lideranças contam no limite próprio (cada liderança tem login).
- D-12 Importação de apoiadores fora do MVP; só cadastro manual e seed.

## Perguntas em aberto (confirmar na aprovação da spec)
- OQ-01 Quem vê endereço/coordenada exata no detalhe? Proposta: Candidato, Coord-geral, Coord-região (só sua região), Liderança (só seus apoiadores). Auditor nunca.
- OQ-02 "Meta de apoiadores" da liderança conta apenas apoiadores com consentimento ativo? Proposta: sim.
- OQ-03 Modo mandato (F3): o que muda além de rótulos? Proposta: esconde Financeiro e metas/ranking, renomeia Apoiador→Cidadão, mantém consentimento por finalidade "mandato".
