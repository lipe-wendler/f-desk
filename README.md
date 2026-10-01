# F.Desk

Sistema de tickets de suporte da **F.Wendler**. A Wen, assistente de IA, faz o primeiro atendimento
(respostas prontas para as perguntas frequentes + LLM para os casos fora do padrão) e escala para um
técnico quando o caso precisa de acompanhamento humano.

| Perfil                 | Como a conta nasce                           | O que acessa                                              |
| ---------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Visitante              | —                                            | Chatbot para tirar dúvidas, sem login                     |
| Cliente (`client`)     | Sozinho, pela tela de cadastro               | Chatbot, abrir chamado, histórico de conversas e chamados |
| Técnico (`technician`) | Criada pelo admin                            | Dashboard e gestão de chamados                            |
| Admin (`admin`)        | Seed do primeiro admin; os demais pelo admin | Tudo do técnico + gestão de usuários                      |

## Stack

Vue 3 + Vite + TypeScript + Tailwind CSS v4 · Hono · better-auth · Neon Postgres + Drizzle ORM ·
Claude API · pnpm workspaces + Turborepo · Vercel.

## Estrutura

```
apps/
  web/        SPA Vue (cliente, técnico e admin)
  api/        API Hono em /api (better-auth, regras de acesso, chat, chamados)
packages/
  ui/         design system F.Wendler em Vue (tokens, fontes, componentes Fw*)
  db/         Drizzle + Neon: schema e migrations
  shared/     perfis, status de chamado e schemas zod usados pelo web e pela api
  config/     tsconfig e ESLint compartilhados
api/          entrada da Vercel Function (encaminha /api/* para apps/api)
docs/         arquitetura, fluxo Git, design system e deploy
```

## Rodando localmente

Requisitos: Node 22 e pnpm 10 (`corepack enable`).

```bash
pnpm install
cp .env.example .env          # preencha DATABASE_URL (Neon) e BETTER_AUTH_SECRET
pnpm db:migrate               # cria as tabelas no Neon
pnpm --filter api seed:admin  # cria o primeiro admin (ADMIN_EMAIL / ADMIN_PASSWORD)
pnpm dev                      # web em http://localhost:5173 e API em http://localhost:3000/api
```

O Vite repassa `/api` para a API, então site e API ficam no mesmo domínio, como na Vercel.
A vitrine do design system fica em `http://localhost:5173/design-system` (só em dev).

| Comando                                                     | O que faz                   |
| ----------------------------------------------------------- | --------------------------- |
| `pnpm dev`                                                  | Sobe web e API              |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` | Checagens (as mesmas do CI) |
| `pnpm format`                                               | Prettier no repositório     |
| `pnpm db:generate` · `pnpm db:migrate`                      | Migrations do Drizzle       |

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Fluxo Git](docs/git-workflow.md)
- [Design system](docs/design-system.md)
- [Deploy na Vercel](docs/deploy.md)
