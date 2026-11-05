# Fluxogramas e diagramas de uso e regras

Fonte única dos diagramas (Mermaid). O preview visual é gerado em `previews/fluxos.html`.

## Arquitetura
Quem fala com quem. A API é a única que toca o banco; o mapa nunca recebe dado pessoal exato.

```mermaid
flowchart LR
  U[Navegador / PWA] -->|HTTPS, cookie httpOnly| W[Web Next.js :3006]
  W -->|API REST /api/v1| A[API NestJS :3001]
  A --> P[(PostgreSQL + PostGIS + pgcrypto)]
  A --> R[(Redis)]
  R --> Q[Fila BullMQ: geocodificação]
  Q -->|1 req/s, cache no banco| N[Nominatim]
  W -.->|estilo online| T[OpenFreeMap]
  W -.->|sem rede| F[Fallback local: bairros em GeoJSON e PMTiles]
```

## Jornada de uso por papel
O que cada papel enxerga ao entrar. O fluxo do e2e é: login, mapa, filtrar bairro, abrir liderança, registrar visita.

```mermaid
flowchart TD
  L[Login com e-mail e senha] --> R{Papel}
  R -->|Candidato ou Coord. geral| A[Mapa de toda a campanha]
  R -->|Coord. de região| B[Mapa só da sua região]
  R -->|Liderança| C[Só a própria base e a própria agenda]
  R -->|Auditor LGPD| D[Logs e consentimentos, só leitura]
  A --> A1[Filtrar bairro ou status] --> A2[Painel lateral do bairro] --> A3[Abrir liderança] --> A4[Registrar visita]
  B --> B1[Filtrar bairro da região] --> A2
  C --> C1[Cadastrar apoiador com consentimento] --> C2[Ver rota do dia] --> C3[Check-in da visita]
  D --> D1[Filtrar logs de acesso] --> D2[Conferir consentimentos]
```

## Cadastro de apoiador
Sem consentimento não há cadastro. A posição vai para o mapa sempre com deslocamento.

```mermaid
flowchart TD
  S([Novo apoiador]) --> F[Preencher nome, bairro e contato]
  F --> C{Consentimento registrado?}
  C -->|Não| X[Bloqueado: erro CONSENT_REQUIRED]
  C -->|Sim| P{Telefone já existe?}
  P -->|Sim| W[Alerta de duplicidade, não bloqueia]
  P -->|Não| G
  W --> G[Salvar com telefone, CPF e endereço cifrados]
  G --> L{Tem coordenada?}
  L -->|Sim| J[Guardar exato cifrado e ponto de mapa com jitter]
  L -->|Não| Q[Fila de geocodificação, 1 por segundo]
  Q --> Y{Encontrou?}
  Y -->|Sim| J
  Y -->|Não| M[Usuário clica no mapa para posicionar]
  M --> J
  J --> O[Atualiza a atividade da liderança]
  O --> Z([Apoiador na base e na lista de comunicação])
```

## Descadastro do titular
Um clique, sem login. Dados pessoais somem; sobra só um registro mínimo como prova.

```mermaid
sequenceDiagram
  actor T as Titular
  participant W as Página pública
  participant A as API
  participant D as Banco
  T->>W: Abre o link remover-dados com o token
  W->>A: GET info do token
  A-->>W: Nome da campanha e se já foi removido
  T->>W: Confirma em 1 clique
  W->>A: POST remover dados
  A->>D: Revoga consentimentos
  A->>D: Anonimiza nome, telefone, CPF, endereço e localização
  A->>D: Grava registro mínimo (hash, data, motivo)
  A->>D: Grava log de acesso REMOVE
  A-->>W: removido
  Note over A,D: Repetir o pedido responde 200 sem novo log
  A->>D: Apoiador some de todas as listas e do mapa
```

## Regras de acesso a cada requisição
A ordem importa: cada etapa pode barrar. Papel sem permissão na rota recebe 403; registro fora do escopo recebe 404.

```mermaid
flowchart TD
  R([Requisição]) --> J{Token JWT válido?}
  J -->|Não| E1[401]
  J -->|Sim| T[Define a campanha do usuário]
  T --> P{Papel permitido nesta rota?}
  P -->|Não| E2[403]
  P -->|Sim| S{Escopo do papel}
  S -->|Candidato, Coord. geral| S1[Tudo da campanha]
  S -->|Coord. de região| S2[Bairros da sua região]
  S -->|Liderança| S3[Sua subárvore de lideranças]
  S1 --> K
  S2 --> K
  S3 --> K{Registro dentro do escopo?}
  K -->|Não| E3[404 e log DENIED]
  K -->|Sim| D{Dado sensível?}
  D -->|Lista ou mapa| D1[Nunca decifra: sem telefone, endereço ou coordenada exata]
  D -->|Detalhe do cadastro| D2[Decifra e grava log de acesso]
  D1 --> OK([Resposta])
  D2 --> OK
```

## Privacidade da posição no mapa
O mapa lê só o ponto deslocado. A coordenada exata fica cifrada e só aparece no detalhe.

```mermaid
flowchart LR
  E[Coordenada exata] --> C[Cifrada com pgcrypto]
  E --> J[Jitter de 30 a 200 m, fixo por apoiador]
  J --> M[Ponto de mapa]
  M --> MAP[API do mapa e camadas: pins, calor, bairro]
  C --> DET[Detalhe do cadastro]
  DET --> AUT{Papel autorizado?}
  AUT -->|Sim| SHOW[Mostra endereço e posição exata e grava log]
  AUT -->|Não| HID[Campos vêm nulos]
```

## Status da liderança
Calculado pela última atividade. O coordenador pode fixar o status à mão.

```mermaid
stateDiagram-v2
  [*] --> Inativo: sem atividade
  Inativo --> Ativo: nova atividade
  Ativo --> Frio: 15 dias sem atividade
  Frio --> Inativo: 46 dias sem atividade
  Frio --> Ativo: nova atividade
  Ativo --> Ativo: atividade em até 14 dias
  note right of Ativo: Override manual vence a regra até ser removido
```

## Mover liderança na árvore
Arrastar leva junto toda a subárvore. Ciclos e destinos fora do escopo são barrados.

```mermaid
flowchart TD
  A([Arrastar liderança para um novo pai ou coordenador]) --> B{Destino no seu escopo?}
  B -->|Não| X1[Rejeita: 422]
  B -->|Sim| C{Destino está dentro da própria subárvore?}
  C -->|Sim| X2[Rejeita: criaria ciclo]
  C -->|Não| D{Coordenador de outra região?}
  D -->|Sim| X3[Rejeita para Coord. de região]
  D -->|Não| E[Atualiza pai e leva os descendentes]
  E --> F[Grava 1 log MOVE na mesma transação]
```

## Ciclo da campanha
Mandato muda rótulos e módulos. Encerrar é irreversível e aplica a política de retenção.

```mermaid
stateDiagram-v2
  [*] --> Campanha
  Campanha --> Mandato: alternar modo
  Mandato --> Campanha: alternar modo
  Campanha --> Encerrada: encerrar, com confirmação dupla
  Mandato --> Encerrada: encerrar, com confirmação dupla
  Encerrada --> [*]
  note right of Encerrada: Retenção da campanha define anonimizar (padrão) ou apagar todos os apoiadores
```

## Demanda da comunidade
Só vira resolvida com o retorno dado ao cidadão registrado.

```mermaid
stateDiagram-v2
  [*] --> Aberta: registrar pedido com bairro, pin e foto
  Aberta --> Encaminhada: encaminhar ao responsável
  Encaminhada --> Resolvida: informar o retorno ao cidadão
  Resolvida --> [*]
```

## Comunicação com consentimento
Nada de disparo em massa: só link individual, enviado manualmente pelo usuário.

```mermaid
flowchart TD
  A([Quero falar com um apoiador]) --> B{Consentimento ativo e cadastro não anonimizado?}
  B -->|Não| X[Fora da lista, sem link: erro CONSENT_REQUIRED]
  B -->|Sim| C{Tem telefone?}
  C -->|Não| Y[Sem link]
  C -->|Sim| D[Gerar link wa.me individual e gravar log]
  D --> E[Usuário abre e envia manualmente no WhatsApp]
```
