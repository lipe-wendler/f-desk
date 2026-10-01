# @f-desk/db

Drizzle ORM sobre o Neon Postgres (driver HTTP `@neondatabase/serverless`, indicado para Vercel Functions).

| Comando (na raiz)                 | O que faz                                                   |
| --------------------------------- | ----------------------------------------------------------- |
| `pnpm db:generate`                | Gera a migration SQL em `drizzle/` a partir de `src/schema` |
| `pnpm db:migrate`                 | Aplica as migrations no banco de `DATABASE_URL` (via HTTP)  |
| `pnpm --filter @f-desk/db studio` | Abre o Drizzle Studio                                       |

- `src/schema/auth.ts` vem do CLI do better-auth. Ao mudar plugins em `apps/api/src/auth.ts`, regere com
  `cd apps/api && npx auth generate --config src/auth.ts --output ../../packages/db/src/schema/auth.ts`
  e depois rode `pnpm db:generate`.
- Migrations rodam fora do deploy da Vercel (localmente ou no CI), nunca no build. O `src/migrate.ts` usa
  o migrator HTTP do Drizzle, então só precisa de HTTPS (a porta 5432 pode estar bloqueada).
- `DATABASE_URL` vem do `.env`/`.env.local` da raiz (`neon link` / `neon env pull`).
