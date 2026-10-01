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
4. Rodar as migrations e o seed contra o banco de produção, fora do build:
   `pnpm db:migrate` e `pnpm --filter api seed:admin` com o `.env` apontando para ele.
