# Deploy na Vercel

Um único projeto Vercel (`f-desk`) a partir da raiz do repositório. O `vercel.json` já define:

- **Build**: `pnpm turbo run build --filter=web --filter=api` → site em `apps/web/dist` e a API empacotada
  em `apps/api/dist/app.js`.
- **Function**: `api/index.js` atende `/api/*` (rewrite) com o app Hono.
- **SPA**: qualquer outra rota cai em `index.html` (Vue Router).

## Passo a passo (uma vez)

1. Importar o repositório na Vercel (Root Directory = raiz; o `vercel.json` cuida do resto).
2. _Storage → Neon_: conectar o banco pela integração. Ela preenche `DATABASE_URL` e cria um branch
   de banco para cada preview, o que casa com o fluxo de uma branch por tarefa.
3. _Settings → Environment Variables_ (Production e Preview):
   - `BETTER_AUTH_SECRET` (`openssl rand -base64 32`)
   - `BETTER_AUTH_URL` só em Production, com o domínio final (nos previews a URL do deploy é usada sozinha)
   - `ANTHROPIC_API_KEY` (a partir da tarefa do chatbot)
4. Rodar as migrations e o seed contra o banco de produção, fora do build (ver abaixo).

## Neon

Projeto **`f-desk`** (`divine-haze-24115227`, `aws-sa-east-1`, Postgres 18, database `f-database`).
Branches: `production` (padrão, usado pela Vercel em produção), `vercel-dev` e um `preview/<branch-git>`
criado pela integração para cada preview.

### CLI na máquina local

```bash
npm i -g neon@latest
neon auth                       # login no navegador (no ambiente cloud do Claude: NEON_API_KEY)
neon link --project-id divine-haze-24115227 --branch production -y
```

O `neon link` grava o contexto em `.neon` e puxa `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `NEON_BRANCH`
para o `.env.local` (os dois ficam fora do git). Para trocar de branch: `neon checkout <branch>` e
`neon env pull`. Todos os scripts do repositório leem `.env` e `.env.local` da raiz.

### Configuração como código (`neon.ts`)

A política em `neon.ts` está vazia de propósito: o F.Desk usa só o Postgres (o login é o better-auth da
nossa API, sem Neon Auth, Data API ou Functions).

```bash
neon config plan   # mostra o que mudaria no branch linkado
neon deploy        # aplica a política
```

### Migrations e primeiro admin

```bash
pnpm db:migrate                # aplica packages/db/drizzle no branch do DATABASE_URL
pnpm --filter api seed:admin   # cria o primeiro admin (ADMIN_EMAIL / ADMIN_PASSWORD no ambiente)
```

- As migrations usam o driver HTTP do Neon (`packages/db/src/migrate.ts`): funcionam onde só há HTTPS,
  como CI e ambientes que bloqueiam a porta 5432.
- Cada preview da Vercel ganha um branch do Neon copiado do `production` **no momento em que é criado**.
  Um branch de preview criado antes de uma migration não tem as tabelas novas: rode
  `neon checkout preview/<branch-git> && neon env pull && pnpm db:migrate` para atualizá-lo.
- Estado atual do `production`: migration `0000_auth-inicial` aplicada e admin criado.

### Agentes (Claude Code)

- Skills da Neon em `.claude/skills/neon*` (atualize com `neon skills update`).
- MCP da Neon em `.mcp.json`, fixado no projeto `divine-haze-24115227`. O login acontece no primeiro uso
  (OAuth), então nenhuma chave fica no repositório.

## Problemas comuns

### API respondendo 500 (`FUNCTION_INVOCATION_FAILED`)

O site abre, mas `/api/*` falha e os logs da Vercel mostram `ZodError … BETTER_AUTH_SECRET`: a variável
não está cadastrada. A API valida o ambiente ao subir (`apps/api/src/env.ts`) e não sobe sem ela.

1. _Settings → Environment Variables_: `BETTER_AUTH_SECRET` (Production e Preview) e
   `BETTER_AUTH_URL=https://f-desk.vercel.app` (só Production).
2. _Deployments_ → último deploy → **Redeploy** (variáveis novas só valem para deploys novos).
3. `https://f-desk.vercel.app/api/health` deve responder `{"ok":true}`.
