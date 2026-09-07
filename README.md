# CIESA CodeLab

CIESA CodeLab é uma plataforma web educacional de programação inspirada em sistemas de judge online, desenvolvida para o Centro Universitário de Ensino Superior do Amazonas.

## Visão geral

Esta é a Fase 1 — Fundação do projeto. O objetivo desta etapa é estruturar o monorepo, as ferramentas de desenvolvimento, a infraestrutura local e as configurações base necessárias para as próximas fases.

## Stack principal

- Frontend: React, Vite, TypeScript, Tailwind CSS, React Router
- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, Zod
- Infraestrutura: Docker, Docker Compose, Redis, pnpm
- Testes: Vitest, Supertest, Playwright

## Estrutura do monorepo

```text
CIESA-CodeLab/
├── apps/
│   ├── web/
│   ├── api/
│   └── executor/
├── packages/
│   ├── contracts/
│   ├── config/
│   └── shared/
├── infrastructure/
│   ├── docker/
│   │   ├── java/
│   │   └── python/
│   └── nginx/
├── docs/
├── tests/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── README.md
├── .gitignore
├── .env.example
└── .npmrc
```

## Requisitos locais

- Node.js 20+
- pnpm 9+
- Docker Desktop ou Docker Engine
- PostgreSQL local via Docker Compose, usando a porta `5433`
- Redis local via Docker Compose, usando a porta `6379`

## Configuração inicial

1. Instale as dependências:

```bash
pnpm install
```

2. Crie e ajuste o arquivo de ambiente local:

No Windows CMD:

```bat
copy .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

No Linux/macOS:

```bash
cp .env.example .env
```

O PostgreSQL do Intranet-CGE utiliza `localhost:5432`. Essa porta não deve ser usada pelo CIESA-CodeLab, que utiliza `localhost:5433`.

3. Inicie a infraestrutura local:

```bash
docker compose up -d postgres redis
```

Verifique os serviços:

```bash
docker compose ps
```

A API fica disponível em `http://localhost:3001/health`. O Redis fica disponível em `localhost:6379`.

4. Rode os scripts de desenvolvimento:

```bash
pnpm dev
```

## Scripts disponíveis

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Prisma

O schema está em `apps/api/prisma/schema.prisma` e usa `DATABASE_URL`. Para validar e gerar o client:

```bash
pnpm --filter @ciesa/api exec prisma validate
pnpm --filter @ciesa/api exec prisma generate
pnpm --filter @ciesa/api exec prisma migrate status
```

As migrations ficam em `apps/api/prisma/migrations`. Não execute `db pull` neste projeto.

## Observações importantes

- Não há autenticação, usuários, cursos ou judge em desenvolvimento nesta fase.
- O executor de código não deve executar código do aluno diretamente dentro da API.
- O Docker Compose apenas prepara PostgreSQL e Redis para uso futuro.
- Nenhum segredo real deve ser incluído no repositório.

## Troubleshooting no Windows

- Se `pnpm` não for reconhecido, abra um novo terminal após instalar o pnpm ou use o caminho completo do `pnpm.cmd`.
- Se o Docker não conectar ao daemon, inicie o Docker Desktop e repita `docker compose up -d postgres redis`.
- Se a porta `5433` estiver ocupada, verifique o processo que a utiliza. Não mude para `5432`, pois essa porta pertence ao PostgreSQL do Intranet-CGE.
- Se PostgreSQL ou Redis não estiverem saudáveis, execute `docker compose ps` e `docker compose logs postgres redis`.

## Próximas etapas

A próxima fase deve continuar somente após validação da fundação atual e revisão da arquitetura.
