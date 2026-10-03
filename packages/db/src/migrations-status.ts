import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Migration do repositório: o `when` do journal e o hash do arquivo, como o drizzle grava. */
export interface LocalMigration {
  tag: string
  when: number
  hash: string
}

/** Linha de `drizzle.__drizzle_migrations`. */
export interface AppliedMigration {
  hash: string
  createdAt: number
}

export interface MigrationStatus {
  /** No repositório e não no banco. */
  pending: LocalMigration[]
  /** No banco com outro hash: o arquivo mudou depois de aplicado. */
  changed: LocalMigration[]
  /** No banco e não no repositório (código mais antigo que o banco, por exemplo num rollback). */
  unknown: AppliedMigration[]
}

/**
 * Lê as migrations de `folder` do jeito do drizzle (`readMigrationFiles`): o `when` do journal vira o
 * `created_at` gravado no banco, e o hash é o sha256 do arquivo `.sql`.
 */
export function readLocalMigrations(folder: string): LocalMigration[] {
  const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
    entries: { tag: string; when: number }[]
  }
  return journal.entries.map(({ tag, when }) => ({
    tag,
    when,
    hash: createHash('sha256')
      .update(readFileSync(join(folder, `${tag}.sql`)).toString())
      .digest('hex'),
  }))
}

/**
 * Compara o repositório com o banco. Uma migration conta como aplicada quando há uma linha com o
 * mesmo `created_at`. O drizzle só aplica as mais novas que a última gravada, então uma migration
 * antiga que ficou para trás aparece aqui como pendente mesmo depois de um `pnpm db:migrate`.
 */
export function migrationStatus(
  local: readonly LocalMigration[],
  applied: readonly AppliedMigration[],
): MigrationStatus {
  const byTime = new Map(applied.map((row) => [row.createdAt, row]))
  const known = new Set(local.map((m) => m.when))
  return {
    pending: local.filter((m) => !byTime.has(m.when)),
    changed: local.filter((m) => {
      const row = byTime.get(m.when)
      return row !== undefined && row.hash !== m.hash
    }),
    unknown: applied.filter((row) => !known.has(row.createdAt)),
  }
}

/**
 * Onde a conferência roda: `VERCEL_ENV` no build da Vercel (`production`, `preview`, `development`;
 * fora dela, `undefined`) ou `check` no `pnpm db:check`.
 */
export type MigrationCheckEnv = 'production' | 'preview' | 'development' | 'check' | undefined

export interface MigrationCheckDeps {
  env: MigrationCheckEnv
  local: readonly LocalMigration[]
  applied: () => Promise<AppliedMigration[]>
  log: (line: string) => void
}

export type MigrationCheckResult =
  { ok: true; skipped: boolean } | { ok: false; reason: 'pending' | 'changed'; tags: string[] }

const tags = (list: readonly { tag: string }[]) => list.map((m) => m.tag)

/** O que fazer com migration pendente, conforme o ambiente (fluxo em `docs/deploy.md`). */
const PENDING_HINT: Record<'production' | 'preview' | 'check', string> = {
  production:
    'Aplique no production (`neon checkout production && pnpm db:migrate`, depois de testar no ' +
    'preview) e refaça o deploy. A versão anterior continua no ar.',
  preview:
    'Aplique no branch do preview (`neon checkout preview/<branch-git> && pnpm db:migrate`) e refaça ' +
    'o deploy.',
  check: 'Aplique com `pnpm db:migrate`.',
}

/**
 * Passo do build da Vercel, antes do build do app: confere se o banco do deploy tem todas as
 * migrations do código. **Nunca aplica nada** (o deploy não altera o banco); com migration pendente
 * ou alterada depois de aplicada, o build falha. Em produção, a versão anterior continua no ar; no
 * preview, o PR fica com o deploy em vermelho até a migration entrar no branch do preview.
 * Fora da Vercel (CI, máquina local) não faz nada; para conferir na mão, `pnpm db:check`.
 */
export async function checkMigrations(deps: MigrationCheckDeps): Promise<MigrationCheckResult> {
  const { env, log } = deps
  if (env !== 'production' && env !== 'preview' && env !== 'check') {
    log('Fora de um deploy da Vercel: migrations não conferidas.')
    return { ok: true, skipped: true }
  }

  const status = migrationStatus(deps.local, await deps.applied())
  if (status.unknown.length)
    log(
      `Aviso: o banco tem ${status.unknown.length} migration(s) que este código não conhece ` +
        '(deploy de uma versão mais antiga?).',
    )
  if (status.changed.length) {
    log(
      `Migration alterada depois de aplicada: ${tags(status.changed).join(', ')}. ` +
        'Não edite migration já aplicada; crie outra com `pnpm db:generate`.',
    )
    return { ok: false, reason: 'changed', tags: tags(status.changed) }
  }
  if (status.pending.length) {
    log(`Migration pendente no banco: ${tags(status.pending).join(', ')}. ${PENDING_HINT[env]}`)
    return { ok: false, reason: 'pending', tags: tags(status.pending) }
  }
  log(`Migrations em dia (${deps.local.length}).`)
  return { ok: true, skipped: false }
}

/**
 * Resumo de um erro que pode ir para o log do build: só o nome e o código do Postgres, procurados na
 * cadeia de `cause` (o drizzle embrulha o erro do driver). Nunca a mensagem, que pode trazer a
 * connection string inteira (o driver do Neon a repete quando ela não é uma URL válida).
 */
export function safeErrorSummary(error: unknown): { name: string; code?: string } {
  const name = error instanceof Error ? error.name : 'Erro'
  for (let current: unknown = error, depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string' && /^[A-Z0-9_]{1,40}$/i.test(code)) return { name, code }
    current = (current as { cause?: unknown }).cause
  }
  return { name }
}

/** `DATABASE_URL` com cara de URL do Postgres (sem ecoar o valor em nenhum caso). */
export function isPostgresUrl(value: string | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'postgres:' || url.protocol === 'postgresql:') && Boolean(url.hostname)
  } catch {
    return false
  }
}
