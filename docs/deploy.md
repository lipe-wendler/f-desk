# Deploy na Vercel

O deploy é automático: todo push numa branch com PR gera um **preview**, e o merge na `main` publica em
**produção**. Este guia tem três partes:

- [Configuração inicial](#configuração-inicial-uma-vez): feita uma vez, já está pronta.
- [A cada mudança no banco](#a-cada-mudança-no-banco-migrations): o fluxo de migrations, em todo PR que
  mexe no schema.
- [Problemas comuns](#problemas-comuns).

Um único projeto Vercel (`f-desk`) a partir da raiz do repositório. O `vercel.json` já define:

- **Build**: `pnpm turbo run build --filter=web --filter=api` → site em `apps/web/dist` e a API empacotada
  em `apps/api/dist/app.js`.
- **Function**: `api/index.js` atende `/api/*` (rewrite) com o app Hono.
- **SPA**: qualquer outra rota cai em `index.html` (Vue Router).

O build nunca roda migrations: um deploy não altera o banco.

## Configuração inicial (uma vez)

### Vercel

1. Importar o repositório na Vercel (Root Directory = raiz; o `vercel.json` cuida do resto).
2. _Storage → Neon_: conectar o banco pela integração. Ela preenche `DATABASE_URL` e cria um branch
   de banco `preview/<branch-git>` para cada preview, copiado do `production` no momento em que é criado.
3. _Settings → Environment Variables_ (Production e Preview), conforme a [tabela de variáveis](#variáveis-de-ambiente).

### Neon

Projeto **`f-desk`** (`divine-haze-24115227`, `aws-sa-east-1`, Postgres 18, database `f-database`).
O ID do projeto não é segredo: sozinho, ele não dá acesso a nada. Segredos (`DATABASE_URL`, chaves de API)
ficam só no `.env`/`.env.local` e nas variáveis da Vercel, nunca no repositório.

Branches fixos: `production` (padrão, usado pela Vercel em produção) e `vercel-dev`. Os `preview/*` e os
de teste são temporários.

CLI na máquina local:

```bash
npm i -g neon@latest
neon auth                       # login no navegador (no ambiente cloud do Claude: NEON_API_KEY)
neon link --project-id divine-haze-24115227 --branch production -y
```

O `neon link` grava o contexto em `.neon` e puxa `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `NEON_BRANCH`
para o `.env.local` (os dois ficam fora do git). Para trocar de branch: `neon checkout <branch>`, que
também atualiza o `.env.local`. Todos os scripts do repositório leem `.env` e `.env.local` da raiz.

A política em `neon.ts` está vazia de propósito: o F.Desk usa só o Postgres (o login é o better-auth da
nossa API, sem Neon Auth, Data API ou Functions). `neon config plan` mostra o que mudaria e `neon deploy`
aplica.

### Primeiro admin

```bash
pnpm --filter api seed:admin   # ADMIN_EMAIL / ADMIN_PASSWORD no ambiente, contra o production
```

## A cada mudança no banco (migrations)

Regras:

- **Toda migration precisa funcionar com o código antigo.** Ela é aplicada no `production` antes do merge,
  então o código que está no ar convive com o schema novo por alguns minutos. Criar tabela, coluna
  opcional ou índice é seguro. Renomear ou apagar é feito em duas tarefas: primeiro o código para de usar,
  depois a migration remove.
- **Nada de dados de teste no `production`.** Testes vão num branch do Neon.
- Migrations rodam pelo driver HTTP (`pnpm db:migrate`), que funciona onde a porta 5432 é bloqueada.

Fluxo de um PR com migration:

1. **Gerar e versionar:** mudar `packages/db/src/schema`, rodar `pnpm db:generate --name <descricao>` e
   commitar o SQL e o `meta/` gerados.
2. **Preview:** depois que a Vercel criar o branch `preview/<branch-git>` do Neon (no primeiro deploy do
   PR), aplicar a migration nele e testar o preview:
   ```bash
   neon checkout preview/<branch-git> && pnpm db:migrate
   ```
3. **Produção, logo antes do merge:**
   ```bash
   neon checkout production && pnpm db:migrate
   ```
4. **Merge** do PR (squash).
5. **Limpeza:** apagar o branch `preview/<branch-git>` no Neon. A integração não apaga sozinha.

Confira o `NEON_BRANCH` no `.env.local` antes de cada `pnpm db:migrate`. O Claude também pode fazer os
passos 2, 3 e 5 pelo MCP da Neon, aplicando o mesmo SQL e o mesmo registro que o `pnpm db:migrate`.

Para ver o que já está aplicado num branch (no editor SQL do console do Neon):

```sql
select id, hash, created_at from drizzle.__drizzle_migrations order by id;
```

Cada linha corresponde, na ordem, a uma entrada de `packages/db/drizzle/meta/_journal.json`; `created_at` é
o campo `when` da entrada.

## Variáveis de ambiente

| Variável                                               | Onde                              | Para quê                                                          |
| ------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                                         | Production e Preview (integração) | Banco do Neon                                                     |
| `BETTER_AUTH_SECRET`                                   | Production e Preview              | Sessões (`openssl rand -base64 32`); também gera o hash do IP     |
| `BETTER_AUTH_URL`                                      | Só Production                     | Domínio final (`https://f-desk.vercel.app`)                       |
| `LLM_MODEL`                                            | Opcional                          | Modelo do chat fora do FAQ; padrão `google:gemini-3.5-flash-lite` |
| `GOOGLE_GENERATIVE_AI_API_KEY`                         | Production e Preview              | Chave do provedor do `LLM_MODEL` padrão                           |
| `ANTHROPIC_API_KEY` · `OPENAI_API_KEY` · `XAI_API_KEY` | Só se `LLM_MODEL` usar o provedor | Chaves dos outros provedores                                      |
| `CHAT_RATE_LIMIT` · `CHAT_RATE_WINDOW_SECONDS`         | Opcional                          | Limite do chat (padrão: 20 mensagens a cada 600 s)                |

Para trocar o modelo do chat, mude `LLM_MODEL` (`<provedor>:<modelo>`, provedores `google`, `anthropic`,
`openai` e `xai`), cadastre a chave do provedor e faça um redeploy. Sem a chave, o chat continua
respondendo pelo FAQ e orienta a abrir um chamado.

## Agentes (Claude Code)

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

### O chat só responde com o aviso para abrir chamado

Os logs mostram `[chat] LLM desligado`: falta a chave do provedor do `LLM_MODEL` ou o valor está fora do
formato `<provedor>:<modelo>`. Cadastre a chave e faça um redeploy. Se aparecer `[chat] falha ao gerar
resposta`, a chave existe, mas o provedor recusou (chave inválida, cota ou modelo inexistente).

### Erro de tabela inexistente num preview ou em produção

A migration do PR não foi aplicada naquele branch do Neon. Siga o
[fluxo de migrations](#a-cada-mudança-no-banco-migrations).
