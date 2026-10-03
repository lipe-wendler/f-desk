import { db, schema } from '@f-desk/db'
import { insertNoteIfOpen, unchangedSince, updateWithMessage } from '@f-desk/db/ticket-writes'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// As escritas de chamado (resposta do cliente, resposta e nota da equipe) gravam só se o chamado
// não mudou desde a leitura. O comportamento contra o Postgres foi conferido num branch do Neon
// (PR #20); aqui fica o formato do SQL, para a regra não se perder numa refatoração.
const { ticket } = schema
/** O dialeto do drizzle transforma o SQL montado em texto e parâmetros (interno, mas estável). */
const dialect = (
  db as unknown as {
    dialect: { sqlToQuery(query: unknown): { sql: string; params: unknown[] } }
  }
).dialect
let queries: { sql: string; params: unknown[] }[] = []
let rows: unknown[] = []

beforeEach(() => {
  queries = []
  rows = []
  vi.spyOn(db, 'execute').mockImplementation((async (query: unknown) => {
    queries.push(dialect.sqlToQuery(query))
    return { rows }
  }) as unknown as typeof db.execute)
})
afterEach(() => vi.restoreAllMocks())

const state = { id: 't-1', status: 'open' as const, assigneeId: null }

describe('updateWithMessage', () => {
  const update = () =>
    db
      .update(ticket)
      .set({ status: 'in_progress' })
      .where(unchangedSince(state))
      .returning({ id: ticket.id })

  it('mensagem e status num comando só, com a condição do estado lido', async () => {
    rows = [{ id: 1 }]
    expect(await updateWithMessage(update(), { authorId: 'tech', content: 'oi' })).toBe(true)
    const [{ sql, params }] = queries as [{ sql: string; params: unknown[] }]
    expect(sql).toMatch(/^\s*with upd as \(update "ticket" set .* returning "id"\)/s)
    expect(sql).toContain('"ticket"."status" = $')
    expect(sql).toContain('"ticket"."assignee_id" is not distinct from $')
    expect(sql).toMatch(/insert into "ticket_message" .* from upd/s)
    expect(params).toEqual(
      expect.arrayContaining(['in_progress', 't-1', 'open', 'tech', 'oi', false]),
    )
  })

  it('nada atualizado (o chamado mudou): devolve false para reler', async () => {
    rows = []
    expect(await updateWithMessage(update(), { authorId: 'tech', content: 'oi' })).toBe(false)
  })
})

describe('insertNoteIfOpen', () => {
  it('só grava a nota em chamado que não está fechado nem cancelado', async () => {
    rows = []
    expect(await insertNoteIfOpen('t-1', 'tech', 'nota')).toBe(false)
    const [{ sql, params }] = queries as [{ sql: string; params: unknown[] }]
    expect(sql).toContain('"ticket"."status" not in ($')
    expect(sql).toMatch(/, true from "ticket"/)
    expect(sql).toContain('for share of "ticket"')
    expect(params).toEqual(expect.arrayContaining(['tech', 'nota', 't-1', 'closed', 'cancelled']))
  })
})
