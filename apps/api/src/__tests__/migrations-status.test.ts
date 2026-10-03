import {
  checkMigrations,
  isPostgresUrl,
  migrationStatus,
  readLocalMigrations,
  safeErrorSummary,
  type AppliedMigration,
  type LocalMigration,
  type MigrationCheckEnv,
} from '@f-desk/db/migrations'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const local: LocalMigration[] = [
  { tag: '0000_a', when: 100, hash: 'h0' },
  { tag: '0001_b', when: 200, hash: 'h1' },
  { tag: '0002_c', when: 300, hash: 'h2' },
]
const appliedUpTo = (n: number): AppliedMigration[] =>
  local.slice(0, n).map((m) => ({ hash: m.hash, createdAt: m.when }))

describe('readLocalMigrations', () => {
  it('lê o journal do repositório com o mesmo hash que o drizzle grava no banco', () => {
    const folder = fileURLToPath(new URL('../../../../packages/db/drizzle', import.meta.url))
    const migrations = readLocalMigrations(folder)
    expect(migrations[0]).toMatchObject({ tag: '0000_auth-inicial', when: 1790895422356 })
    // Hash conferido no `drizzle.__drizzle_migrations` do production.
    expect(migrations.find((m) => m.tag === '0006_conversa-mensagem-importada')).toEqual({
      tag: '0006_conversa-mensagem-importada',
      when: 1790983330123,
      hash: 'e9a24f4f2fe58f434db197d8125d25ce6ca74e674b4a3d2878f50e8ddbc0a9e4',
    })
  })
})

describe('migrationStatus', () => {
  it('banco em dia', () => {
    expect(migrationStatus(local, appliedUpTo(3))).toEqual({
      pending: [],
      changed: [],
      unknown: [],
    })
  })

  it('migration pendente, inclusive uma antiga que ficou para trás', () => {
    expect(migrationStatus(local, appliedUpTo(1)).pending.map((m) => m.tag)).toEqual([
      '0001_b',
      '0002_c',
    ])
    const gap = [appliedUpTo(3)[0]!, appliedUpTo(3)[2]!]
    expect(migrationStatus(local, gap).pending.map((m) => m.tag)).toEqual(['0001_b'])
  })

  it('hash diferente: o arquivo mudou depois de aplicado', () => {
    const applied = appliedUpTo(3).map((row, i) => (i === 1 ? { ...row, hash: 'outro' } : row))
    expect(migrationStatus(local, applied)).toMatchObject({
      pending: [],
      changed: [{ tag: '0001_b' }],
    })
  })

  it('o banco conhece uma migration que o código não tem', () => {
    const applied = [...appliedUpTo(3), { hash: 'h3', createdAt: 400 }]
    expect(migrationStatus(local, applied).unknown).toEqual([{ hash: 'h3', createdAt: 400 }])
  })
})

describe('checkMigrations', () => {
  function run(env: MigrationCheckEnv, appliedCount: number) {
    const lines: string[] = []
    const applied = vi.fn(async () => appliedUpTo(appliedCount))
    const promise = checkMigrations({ env, local, applied, log: (line) => lines.push(line) })
    return { promise, applied, lines }
  }

  it('fora da Vercel (CI, máquina local) não consulta o banco', async () => {
    for (const env of [undefined, 'development'] as const) {
      const { promise, applied } = run(env, 0)
      expect(await promise).toEqual({ ok: true, skipped: true })
      expect(applied).not.toHaveBeenCalled()
    }
  })

  it('banco em dia segue o build', async () => {
    for (const env of ['production', 'preview', 'check'] as const) {
      const { promise, lines } = run(env, 3)
      expect(await promise).toEqual({ ok: true, skipped: false })
      expect(lines).toEqual(['Migrations em dia (3).'])
    }
  })

  it('production com migration pendente falha o build, e a versão anterior fica no ar', async () => {
    const { promise, lines } = run('production', 2)
    expect(await promise).toEqual({ ok: false, reason: 'pending', tags: ['0002_c'] })
    expect(lines.join('\n')).toContain('neon checkout production && pnpm db:migrate')
    expect(lines.join('\n')).toContain('A versão anterior continua no ar.')
  })

  it('preview com migration pendente falha e diz para aplicar no branch do preview', async () => {
    const { promise, lines } = run('preview', 1)
    expect(await promise).toEqual({ ok: false, reason: 'pending', tags: ['0001_b', '0002_c'] })
    expect(lines.join('\n')).toContain('neon checkout preview/<branch-git> && pnpm db:migrate')
  })

  it('pnpm db:check aponta a pendência', async () => {
    const { promise, lines } = run('check', 0)
    expect(await promise).toMatchObject({ ok: false, reason: 'pending' })
    expect(lines.join('\n')).toContain('Aplique com `pnpm db:migrate`.')
  })

  it('migration alterada depois de aplicada falha o build', async () => {
    const result = await checkMigrations({
      env: 'production',
      local,
      applied: async () => appliedUpTo(3).map((r, i) => (i === 0 ? { ...r, hash: 'x' } : r)),
      log: () => undefined,
    })
    expect(result).toEqual({ ok: false, reason: 'changed', tags: ['0000_a'] })
  })

  it('banco com migration que o código não conhece só gera aviso', async () => {
    const lines: string[] = []
    const result = await checkMigrations({
      env: 'production',
      local,
      applied: async () => [...appliedUpTo(3), { hash: 'h3', createdAt: 400 }],
      log: (line) => lines.push(line),
    })
    expect(result).toEqual({ ok: true, skipped: false })
    expect(lines[0]).toContain('Aviso: o banco tem 1 migration(s)')
  })
})

describe('log do build sem a connection string', () => {
  const SECRET = 'postgresql://usuario:SENHA-SECRETA@ep-x.neon.tech/db'

  it('o resumo do erro tem só nome e código, procurando o código na cadeia de cause', () => {
    // Como o drizzle entrega o erro do driver: a mensagem pode repetir a connection string.
    const driver = Object.assign(new Error(`connection string: ${SECRET}`), { code: '42P01' })
    const wrapped = new Error(`Failed query: ${SECRET}`, { cause: driver })
    wrapped.name = 'DrizzleQueryError'
    const summary = safeErrorSummary(wrapped)
    expect(summary).toEqual({ name: 'DrizzleQueryError', code: '42P01' })
    expect(JSON.stringify(summary)).not.toContain('SENHA-SECRETA')
    expect(safeErrorSummary(new Error(SECRET))).toEqual({ name: 'Error' })
    expect(safeErrorSummary(SECRET)).toEqual({ name: 'Erro' })
    // Código que não tem cara de código não sai no log.
    expect(safeErrorSummary(Object.assign(new Error('x'), { code: SECRET }))).toEqual({
      name: 'Error',
    })
  })

  it('só aceita DATABASE_URL que seja uma URL do Postgres', () => {
    expect(isPostgresUrl(SECRET)).toBe(true)
    expect(isPostgresUrl('postgres://u:p@host/db')).toBe(true)
    expect(isPostgresUrl(undefined)).toBe(false)
    expect(isPostgresUrl('')).toBe(false)
    expect(isPostgresUrl(`psql '${SECRET}'`)).toBe(false)
    expect(isPostgresUrl(`'${SECRET}'`)).toBe(false)
    expect(isPostgresUrl('https://ep-x.neon.tech/sql')).toBe(false)
  })
})
