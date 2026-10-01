// Aplica as migrations de ./drizzle pelo driver HTTP do Neon (só HTTPS, sem TCP 5432):
// funciona na máquina local, no CI e em ambientes onde a porta do Postgres é bloqueada.
// Uso: `pnpm db:migrate` com DATABASE_URL no .env/.env.local da raiz.
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { fileURLToPath } from 'node:url'
import { db } from './client'

if (!process.env.DATABASE_URL) {
  console.error('Defina DATABASE_URL (rode `neon link` ou `neon env pull` na raiz).')
  process.exit(1)
}

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
await migrate(db, { migrationsFolder })
console.log('✓ Migrations aplicadas')
