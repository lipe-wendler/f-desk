// Confere se o banco tem todas as migrations do código, sem aplicar nada (regras em
// `checkMigrations`). Roda no build da Vercel antes do build do app (`vercel.json`) e na mão com
// `pnpm db:check`, contra o DATABASE_URL do .env/.env.local da raiz.
import { sql } from 'drizzle-orm'
import { fileURLToPath } from 'node:url'
import { db } from './client'
import {
  checkMigrations,
  readLocalMigrations,
  type AppliedMigration,
  type MigrationCheckEnv,
} from './migrations-status'

const env = (
  process.argv.includes('--check') ? 'check' : process.env.VERCEL_ENV
) as MigrationCheckEnv
const needsDb = env === 'production' || env === 'preview' || env === 'check'

if (needsDb && !process.env.DATABASE_URL) {
  console.error('[migrations] Defina DATABASE_URL para conferir as migrations.')
  process.exit(1)
}

/** Tabela de controle do drizzle; sem ela (banco novo), nada foi aplicado. */
async function applied(): Promise<AppliedMigration[]> {
  try {
    const { rows } = await db.execute<{ hash: string; created_at: string | number }>(
      sql`select hash, created_at from drizzle.__drizzle_migrations`,
    )
    return rows.map((row) => ({ hash: row.hash, createdAt: Number(row.created_at) }))
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === '42P01' || code === '3F000') return []
    throw error
  }
}

const result = await checkMigrations({
  env,
  local: readLocalMigrations(fileURLToPath(new URL('../drizzle', import.meta.url))),
  applied,
  log: (line) => console.log(`[migrations] ${line}`),
})
if (!result.ok) process.exit(1)
