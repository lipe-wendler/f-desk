// Confere se o banco tem todas as migrations do código, sem aplicar nada (regras em
// `checkMigrations`). Roda no build da Vercel antes do build do app (`vercel.json`) e na mão com
// `pnpm db:check`, contra o DATABASE_URL do .env/.env.local da raiz.
// O log do build é visível para o time inteiro: nada aqui imprime a connection string nem a
// mensagem de erro do driver (que pode trazê-la), só nomes e códigos (`safeErrorSummary`).
import { sql } from 'drizzle-orm'
import { fileURLToPath } from 'node:url'
import {
  checkMigrations,
  isPostgresUrl,
  readLocalMigrations,
  safeErrorSummary,
  type AppliedMigration,
  type MigrationCheckEnv,
} from './migrations-status'

/** Sem resposta do banco nesse tempo, o build falha em vez de esperar até o limite da Vercel. */
const TIMEOUT_MS = 30_000
/** Tabela ou schema inexistente: banco novo, sem nenhuma migration aplicada. */
const NOTHING_APPLIED = new Set(['42P01', '3F000'])

const log = (line: string) => console.log(`[migrations] ${line}`)
const env = (
  process.argv.includes('--check') ? 'check' : process.env.VERCEL_ENV
) as MigrationCheckEnv
const needsDb = env === 'production' || env === 'preview' || env === 'check'

if (needsDb && !isPostgresUrl(process.env.DATABASE_URL)) {
  log(
    'DATABASE_URL ausente ou inválido (não é uma URL postgresql://). Confira a variável do ambiente.',
  )
  process.exit(1)
}

async function main() {
  // Só depois de validar a URL: o cliente lê o DATABASE_URL ao ser importado.
  const { db } = await import('./client')

  /** Tabela de controle do drizzle; sem ela (banco novo), nada foi aplicado. */
  async function applied(): Promise<AppliedMigration[]> {
    try {
      const { rows } = await db.execute<{ hash: string; created_at: string | number }>(
        sql`select hash, created_at from drizzle.__drizzle_migrations`,
      )
      return rows.map((row) => ({ hash: row.hash, createdAt: Number(row.created_at) }))
    } catch (error) {
      const { code } = safeErrorSummary(error)
      if (code && NOTHING_APPLIED.has(code)) return []
      throw error
    }
  }

  return checkMigrations({
    env,
    local: readLocalMigrations(fileURLToPath(new URL('../drizzle', import.meta.url))),
    applied,
    log,
  })
}

const timeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS).unref(),
)

try {
  const result = await Promise.race([main(), timeout])
  process.exit(result.ok ? 0 : 1)
} catch (error) {
  const { name, code } = safeErrorSummary(error)
  log(
    (error as Error).message === 'timeout'
      ? `O banco não respondeu em ${TIMEOUT_MS / 1000} s.`
      : `Falha ao consultar o banco: ${name}${code ? ` (código ${code})` : ''}. ` +
          'Detalhes omitidos para não expor a connection string.',
  )
  process.exit(1)
}
