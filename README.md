# PostFlow

**Backend de agendamento e publicação automática de posts no Telegram.**

Sistema que permite criar, agendar e publicar posts em canais do Telegram de forma automatizada, com fila de processamento, retry com backoff exponencial, monitormaneto via Prometheus/Grafana e autenticação JWT.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Stack Tecnológica](#stack-tecnológica)
- [Arquitetura](#arquitetura)
- [Modelo de Dados](#modelo-de-dados)
- [Fluxo de Publicação](#fluxo-de-publicação)
- [API](#api)
- [Infraestrutura](#infraestrutura)
- [Como Executar](#como-executar)
- [Variáveis de Ambiente](#variáveis-de-ambiente)

---

## Visão Geral

PostFlow é o backend de um sistema de automação de posts para Telegram. O fluxo é:

1. O usuário registra um canal do Telegram informando o **token do bot** e o **chat ID**
2. O sistema valida se o bot tem permissão de postar no canal
3. O usuário cria um post com título, legenda, imagem e data/hora de agendamento
4. Na data agendada, um **worker** processa a fila e envia o post para o Telegram
4. Se falhar, o sistema faz **retry automático** com backoff exponencial (até 5 tentativas)
5. Depois de todas as tentativas, o post vai para uma **dead letter queue**

- **Autenticação:** JWT com expiração de 7 dias
- **Validação:** Zod schemas em todas as rotas
- **ORM:** Prisma com PostgreSQL
- **Filas:** BullMQ com Redis

---

## Stack Tecnológica

| Categoria | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 20 (Alpine) |
| Framework | Fastify | 4.26 |
| ORM | Prisma | 5.10 |
| Banco de Dados | PostgreSQL | 16 |
| Fila | BullMQ | 5.7 |
| Cache/Fila | Redis | 7 |
| Autenticação | JWT (jsonwebtoken) | 9.0 |
| Bot Telegram | Telegraf | 4.16 |
| Validação | Zod | 3.22 |
| Métricas | prom-client | 15.1 |
| Monitoramento | Prometheus + Grafana | latest |
| Containerização | Docker + Docker Compose | — |
| Linguagem | TypeScript | 5.3 |

---

## Arquitetura

```
                    ┌─────────────┐
                    │   Cliente   │
                    │  (Postman)  │
                    └──────┬──────┘
                           │ HTTP
                           ▼
              ┌────────────────────────┐
              │     Fastify API        │
              │    (porta 3000)        │
              │                        │
              │  ┌──────┐ ┌────────┐   │
              │  │ Auth │ │  Posts │   │
              │  ├──────┤ ├────────┤   │
              │  │Users │ │Telegram│   │
              │  └──────┘ └────────┘   │
              │                        │
              │  GET /metrics          │
              └──────┬──────┬──────────┘
                     │      │
                     │      │ Redis
                     │      ▼
                     │  ┌──────────────────┐
                     │  │   BullMQ Queues  │
                     │  │                  │
                     │  │ • publish-post   │
                     │  │ • retry-post     │
                     │  │ • dead-letter    │
                     │  └────────┬─────────┘
                     │           │
                     │           ▼
                     │  ┌──────────────────┐
                     │  │  Worker (Node)   │
                     │  │  publish-post    │
                     │  └────────┬─────────┘
                     │           │
                     │           ▼
                     │  ┌──────────────────┐
                     │  │   Telegram API   │
                     │  └──────────────────┘
                     │
                     │ Prometheus (porta 9090)
                     ▼
              ┌────────────────────────┐
              │      Prometheus        │
              │   scrape /metrics      │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │       Grafana          │
              │    (porta 3030)       │
              │  Dashboards + Alertas │
              └────────────────────────┘
```

### Estrutura de Diretórios

```
src/
├── app/                          # Configuração do Fastify
│   ├── app.ts                    #   Build da aplicação (plugins, rotas, error handler)
│   └── server.ts                 #   Entrypoint (listen)
├── config/
│   └── env.ts                    # Validação de variáveis de ambiente com Zod
├── database/prisma/
│   └── client.ts                 # Instância singleton do Prisma Client
├── infra/                        # Infraestrutura (Docker, monitoramento)
│   ├── grafana/
│   │   ├── dashboards/           #   Provisioning de dashboards
│   │   └── datasources/          #   Provisioning de datasources
│   └── prometheus/
│       └── prometheus.yml        #   Configuração de scrape
├── modules/                      # Módulos da aplicação (domain-driven)
│   ├── auth/                     #   Autenticação (register, login)
│   ├── metrics/                  #   Métricas Prometheus
│   ├── posts/                    #   CRUD de posts
│   ├── telegram/                 #   Gerenciamento de canais Telegram
│   └── users/                    #   Perfil do usuário
├── plugins/                      # Plugins do Fastify
│   ├── jwt.ts                    #   JWT sign/verify + middleware authenticate
│   └── redis.ts                  #   Conexão Redis (ioredis)
├── queues/
│   └── index.ts                  # Definição das filas BullMQ (publish, retry, dead-letter)
├── repositories/                 # Data access layer (Prisma)
│   ├── job.repository.ts
│   ├── post.repository.ts
│   ├── telegram-channel.repository.ts
│   └── user.repository.ts
├── services/
│   ├── storage.service.ts        # Upload de imagens (placeholder)
│   └── telegram.service.ts       # Integração com a API do Telegram (Telegraf)
├── shared/
│   ├── constants/                # Enums do sistema
│   │   ├── job-status.ts
│   │   ├── post-status.ts
│   │   └── queues.ts
│   ├── errors/                   # Classes de erro customizadas
│   │   └── app-error.ts
│   └── types/
│       └── index.ts              # Interfaces compartilhadas
└── workers/
    └── publish-post.worker.ts    # Worker BullMQ que publica no Telegram
```

---

## Modelo de Dados

```mermaid
erDiagram
    User ||--o{ TelegramChannel : has
    User ||--o{ Post : creates
    TelegramChannel ||--o{ Post : target
    Post ||--o{ Job : tracks
    
    User {
        uuid id PK
        string name
        string email UK
        string password_hash
        datetime created_at
    }
    
    TelegramChannel {
        uuid id PK
        uuid user_id FK
        text bot_token
        text chat_id
        datetime created_at
    }
    
    Post {
        uuid id PK
        uuid user_id FK
        uuid channel_id FK
        string title
        text caption
        text image_url
        string status "DRAFT | SCHEDULED | PROCESSING | PUBLISHED | FAILED | RETRYING | CANCELLED"
        datetime scheduled_at
        datetime published_at NULL
        datetime created_at
    }
    
    Job {
        uuid id PK
        uuid post_id FK
        string queue_name
        string status "PENDING | ACTIVE | COMPLETED | FAILED | DELAYED | CANCELLED"
        int attempts
        datetime created_at
    }
```

### Ciclo de Vida de um Post

```
DRAFT → SCHEDULED → PROCESSING → PUBLISHED
                         │
                         ▼
                      FAILED → RETRYING → PROCESSING (nova tentativa)
                         │
                         ▼
                   DEAD LETTER (após 5 tentativas)
```

---

## Fluxo de Publicação

```
POST /posts
  │
  ├─ Valida dados com Zod
  ├─ Verifica se o canal pertence ao usuário
  ├─ Cria o post no banco (status: DRAFT)
  ├─ Adiciona job na fila "publish-post" com delay = scheduledAt - now
  ├─ Atualiza status para SCHEDULED
  └─ Retorna 201 + bullJobId

Worker (quando o delay expira)
  │
  ├─ Busca o post no banco
  ├─ Se CANCELLED → descarta o job
  ├─ Atualiza status para PROCESSING
  ├─ Envia a foto + legenda para o Telegram
  ├─ Se sucesso → marca PUBLISHED, incrementa métrica
  │
  └─ Se falha →
       ├─ Marca FAILED
       ├─ Se ainda há tentativas → adiciona na "retry-post" com backoff exponencial (5s, 10s, 20s, 40s...)
       └─ Se esgotou tentativas → não faz mais nada (dead letter implícita)
```

### Filas BullMQ

| Fila | Finalidade | Tentativas | Backoff |
|---|---|---|---|
| `publish-post` | Publicação inicial | 5 | Exponencial (5s base) |
| `retry-post` | Retry após falha | 10 | Exponencial (5s base) |
| `dead-letter` | Post não publicado | 1 | Nenhum |

---

## API

### Públicas (sem autenticação)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Registra novo usuário (`name`, `email`, `password`) |
| POST | `/auth/login` | Login, retorna JWT (`email`, `password`) |
| GET | `/metrics` | Métricas no formato Prometheus |

### Autenticadas (header `Authorization: Bearer <token>`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/users/me` | Dados do usuário logado |
| POST | `/telegram/channels` | Registrar canal do Telegram (`botToken`, `chatId`) |
| GET | `/telegram/channels` | Listar canais do usuário |
| DELETE | `/telegram/channels/:id` | Remover canal |
| POST | `/telegram/channels/:id/test` | Testar conexão com o bot |
| POST | `/posts` | Criar/agendar post (`title`, `caption`, `imageUrl`, `scheduledAt`, `channelId`) |
| GET | `/posts` | Listar posts (query: `page`, `limit`, `status`) |
| GET | `/posts/:id` | Detalhes de um post |
| PATCH | `/posts/:id/cancel` | Cancelar post agendado |
| PATCH | `/posts/:id/reschedule` | Reagendar post (`scheduledAt`) |

---

## Infraestrutura

### Docker Compose

O projeto possui 6 serviços definidos em `docker-compose.yml`:

| Serviço | Imagem | Porta | Finalidade |
|---|---|---|---|
| `postgres` | postgres:16-alpine | 5432 | Banco de dados |
| `redis` | redis:7-alpine | 6379 | Filas + cache |
| `api` | build local | 3000 | Servidor Fastify |
| `worker` | build local | — | Worker BullMQ |
| `prometheus` | prom/prometheus | 9090 | Coleta de métricas |
| `grafana` | grafana/grafana | 3030 | Dashboards |

### Prometheus

- Config: `src/infra/prometheus/prometheus.yml`
- **Scrape interval:** 15s
- **Target:** `api:3000/metrics`
- Coleta métricas customizadas (posts, jobs, filas) + default metrics do Node.js (CPU, memória, event loop)

### Grafana

- **Provisioning automático** via `src/infra/grafana/`
- **Datasource:** Prometheus (já configurado, URL: `http://prometheus:9090`)
- **Dashboard:** PostFlow - Monitoramento (9 painéis)
  - Taxa de posts criados, publicados e com falha
  - Jobs na fila (aguardando, ativos, falhos)
  - Duração da publicação (P99)
  - CPU e memória heap do Node.js
  - Event loop lag

### Métricas Prometheus Customizadas

| Métrica | Tipo | Descrição |
|---|---|---|
| `posts_created_total` | Counter | Total de posts criados |
| `posts_published_total` | Counter | Total de posts publicados com sucesso |
| `posts_failed_total` | Counter | Total de posts que falharam |
| `jobs_processed_total` | Counter | Total de jobs processados |
| `publish_duration_seconds` | Histogram | Duração da publicação (buckets: 0.1, 0.5, 1, 2, 5, 10s) |
| `bullmq_waiting_jobs` | Gauge | Jobs aguardando na fila |
| `bullmq_active_jobs` | Gauge | Jobs ativos na fila |
| `bullmq_failed_jobs` | Gauge | Jobs com falha na fila |

---

## Como Executar

### Desenvolvimento (local)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env (ou copiar o existente)
# DATABASE_URL, REDIS_URL, JWT_SECRET, PORT, HOST

# 3. Subir PostgreSQL e Redis
docker compose up -d postgres redis

# 4. Rodar migrations do Prisma
npx prisma migrate dev

# 5. Iniciar API + Worker (em terminais separados)
npx tsx watch src/app/server.ts
npx tsx watch src/workers/publish-post.worker.ts
```

### Produção (Docker Compose)

```bash
# Sobe todos os serviços
docker compose up -d

# Serviços:
#   API:       http://localhost:3000
#   Grafana:   http://localhost:3030  (admin / admin)
#   Prometheus: http://localhost:9090

# Ver logs
docker compose logs -f api worker
```

### Acessando o Grafana

1. Abra `http://localhost:3030`
2. Login: `admin` / `admin` (troca a senha no primeiro acesso)
3. O dashboard "PostFlow - Monitoramento" já estará disponível
4. O datasource Prometheus já vem pré-configurado

---

## Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DATABASE_URL` | Sim | — | URL de conexão do PostgreSQL |
| `REDIS_URL` | Sim | — | URL de conexão do Redis |
| `JWT_SECRET` | Sim | — | Chave secreta para assinar JWT (mín. 16 caracteres) |
| `PORT` | Não | 3000 | Porta do servidor HTTP |
| `HOST` | Não | 0.0.0.0 | Host do servidor HTTP |
| `NODE_ENV` | Não | development | Ambiente (`development`, `production`, `test`) |

---

## Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia a API com hot-reload (tsx watch) |
| `npm run build` | Compila TypeScript para JavaScript |
| `npm start` | Inicia a API compilada |
| `npm run worker` | Inicia o worker com hot-reload |
| `npx prisma studio` | Abre o Prisma Studio (interface do banco) |
| `npx prisma migrate dev` | Cria/executa migrations |
| `npx prisma generate` | Gera o Prisma Client |
