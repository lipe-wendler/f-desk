import { planTicketUpdate, staffReplyEffects } from '@f-desk/shared'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '../middleware/session'
import { createStaffRoute, type StaffStore } from '../routes/staff'

describe('planTicketUpdate', () => {
  const open = { status: 'open' as const, assigneeId: null }

  it('aceita transições válidas e grava as datas', () => {
    expect(planTicketUpdate(open, { status: 'resolved' })).toEqual({
      ok: true,
      changes: { status: 'resolved', resolvedAt: 'now' },
    })
    expect(
      planTicketUpdate({ status: 'resolved', assigneeId: 't1' }, { status: 'in_progress' }),
    ).toEqual({
      ok: true,
      changes: { status: 'in_progress', resolvedAt: null },
    })
    expect(planTicketUpdate(open, { status: 'closed' })).toEqual({
      ok: true,
      changes: { status: 'closed', closedAt: 'now', closeReason: 'staff' },
    })
  })

  it('recusa transição inválida e qualquer mudança em chamado fechado', () => {
    expect(planTicketUpdate({ status: 'resolved', assigneeId: null }, { status: 'open' })).toEqual({
      ok: false,
      error: 'INVALID_TRANSITION',
    })
    expect(planTicketUpdate({ status: 'closed', assigneeId: null }, { priority: 'high' })).toEqual({
      ok: false,
      error: 'CLOSED',
    })
  })

  it('a equipe não cancela chamado, e chamado cancelado não muda mais', () => {
    expect(planTicketUpdate(open, { status: 'cancelled' })).toEqual({
      ok: false,
      error: 'CLIENT_ONLY',
    })
    for (const input of [
      { priority: 'high' as const },
      { status: 'open' as const },
      { assigneeId: 't1' },
    ])
      expect(planTicketUpdate({ status: 'cancelled', assigneeId: null }, input)).toEqual({
        ok: false,
        error: 'CLOSED',
      })
  })

  it('status igual não é transição; prioridade e responsável passam direto', () => {
    expect(
      planTicketUpdate(open, { status: 'open', priority: 'urgent', assigneeId: 't1' }),
    ).toEqual({
      ok: true,
      changes: { priority: 'urgent', assigneeId: 't1' },
    })
    expect(planTicketUpdate({ status: 'open', assigneeId: 't1' }, { assigneeId: null })).toEqual({
      ok: true,
      changes: { assigneeId: null },
    })
  })
})

describe('staffReplyEffects', () => {
  it('primeira resposta pública num chamado aberto: em atendimento e atribuído a quem respondeu', () => {
    expect(staffReplyEffects({ status: 'open', assigneeId: null }, 't1', false)).toEqual({
      status: 'in_progress',
      assigneeId: 't1',
    })
    expect(staffReplyEffects({ status: 'open', assigneeId: 't2' }, 't1', false)).toEqual({
      status: 'in_progress',
    })
  })

  it('nota interna e chamados já em andamento não mudam', () => {
    expect(staffReplyEffects({ status: 'open', assigneeId: null }, 't1', true)).toEqual({})
    expect(staffReplyEffects({ status: 'waiting_client', assigneeId: null }, 't1', false)).toEqual(
      {},
    )
  })
})

type User = NonNullable<AppEnv['Variables']['user']>
const tech = { id: 't1', role: 'technician', banned: false } as User
const admin = { id: 'a1', role: 'admin', banned: false } as User
const client = { id: 'c1', role: 'client', banned: false } as User

const store = {
  list: vi.fn(),
  metrics: vi.fn(),
  get: vi.fn(),
  reply: vi.fn(),
  update: vi.fn(),
  assignees: vi.fn(),
} satisfies Record<keyof StaffStore, ReturnType<typeof vi.fn>>

function appAs(user: User | null) {
  return new Hono<AppEnv>()
    .use('*', async (c, next) => {
      c.set('user', user)
      c.set('session', null)
      await next()
    })
    .route('/staff', createStaffRoute(store as unknown as StaffStore))
}

const send = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

beforeEach(() => vi.resetAllMocks())

describe('/staff', () => {
  it('só técnico e admin', async () => {
    expect((await appAs(null).request('/staff/tickets')).status).toBe(401)
    expect((await appAs(client).request('/staff/tickets')).status).toBe(403)
    store.list.mockResolvedValue({ tickets: [], total: 0 })
    expect((await appAs(tech).request('/staff/tickets')).status).toBe(200)
    expect((await appAs(admin).request('/staff/tickets')).status).toBe(200)
  })

  it('fila com filtros e paginação', async () => {
    store.list.mockResolvedValue({ tickets: [], total: 0 })
    await appAs(tech).request('/staff/tickets?queue=mine&priority=urgent&search=vpn&page=2')
    expect(store.list).toHaveBeenCalledWith({
      staffId: 't1',
      queue: 'mine',
      priority: 'urgent',
      search: 'vpn',
      limit: 20,
      offset: 20,
    })
    expect((await appAs(tech).request('/staff/tickets?queue=x')).status).toBe(400)
  })

  it('métricas de quem está logado e lista de responsáveis', async () => {
    store.metrics.mockResolvedValue({ open: 1 })
    store.assignees.mockResolvedValue([{ id: 't1', name: 'Téo', role: 'technician' }])
    expect(await (await appAs(tech).request('/staff/metrics')).json()).toEqual({ open: 1 })
    expect(store.metrics).toHaveBeenCalledWith('t1')
    expect(await (await appAs(tech).request('/staff/assignees')).json()).toEqual({
      assignees: [{ id: 't1', name: 'Téo', role: 'technician' }],
    })
  })

  it('resposta e nota interna', async () => {
    store.reply.mockResolvedValue({ ok: true, status: 'in_progress', assigneeId: 't1' })
    const res = await appAs(tech).request(
      '/staff/tickets/TKT-0001/messages',
      send('POST', { content: ' Verificando ', internal: true }),
    )
    expect(res.status).toBe(201)
    expect(store.reply).toHaveBeenCalledWith('t1', 'TKT-0001', 'Verificando', true)
    store.reply.mockResolvedValue({ ok: false, reason: 'closed' })
    expect(
      (
        await appAs(tech).request(
          '/staff/tickets/TKT-0001/messages',
          send('POST', { content: 'oi' }),
        )
      ).status,
    ).toBe(409)
  })

  it('resposta e alteração num chamado que mudou no meio do caminho dão 409', async () => {
    store.reply.mockResolvedValue({ ok: false, reason: 'conflict' })
    const reply = await appAs(tech).request(
      '/staff/tickets/TKT-0001/messages',
      send('POST', { content: 'oi' }),
    )
    expect(reply.status).toBe(409)
    expect(await reply.json()).toMatchObject({ code: 'STALE' })

    store.reply.mockResolvedValue({ ok: false, reason: 'closed' })
    const closed = await appAs(tech).request(
      '/staff/tickets/TKT-0001/messages',
      send('POST', { content: 'oi' }),
    )
    expect(closed.status).toBe(409)
    expect(await closed.json()).toMatchObject({ code: 'CLOSED' })

    store.update.mockResolvedValue({ ok: false, reason: 'STALE' })
    const update = await appAs(tech).request(
      '/staff/tickets/TKT-0001',
      send('PATCH', { status: 'resolved' }),
    )
    expect(update.status).toBe(409)
    expect(await update.json()).toEqual({
      error: 'O chamado mudou agora há pouco. Recarregue e tente de novo.',
      code: 'STALE',
    })
  })

  it('alteração: valida o corpo e traduz os erros das regras', async () => {
    expect((await appAs(tech).request('/staff/tickets/TKT-0001', send('PATCH', {}))).status).toBe(
      400,
    )
    expect(
      (await appAs(tech).request('/staff/tickets/TKT-0001', send('PATCH', { status: 'pendente' })))
        .status,
    ).toBe(400)

    store.update.mockResolvedValue({ ok: false, reason: 'INVALID_TRANSITION' })
    const invalid = await appAs(tech).request(
      '/staff/tickets/TKT-0001',
      send('PATCH', { status: 'open' }),
    )
    expect(invalid.status).toBe(409)
    expect(await invalid.json()).toMatchObject({ code: 'INVALID_TRANSITION' })

    store.update.mockResolvedValue({ ok: false, reason: 'CLIENT_ONLY' })
    const cancel = await appAs(tech).request(
      '/staff/tickets/TKT-0001',
      send('PATCH', { status: 'cancelled' }),
    )
    expect(cancel.status).toBe(409)
    expect(await cancel.json()).toEqual({
      error: 'Só o cliente pode cancelar o chamado.',
      code: 'CLIENT_ONLY',
    })

    store.update.mockResolvedValue({ ok: false, reason: 'INVALID_ASSIGNEE' })
    expect(
      (await appAs(tech).request('/staff/tickets/TKT-0001', send('PATCH', { assigneeId: 'c1' })))
        .status,
    ).toBe(400)

    store.update.mockResolvedValue({ ok: true })
    const ok = await appAs(tech).request(
      '/staff/tickets/TKT-0001',
      send('PATCH', { priority: 'high', assigneeId: null }),
    )
    expect(ok.status).toBe(200)
    expect(store.update).toHaveBeenLastCalledWith('TKT-0001', {
      priority: 'high',
      assigneeId: null,
    })
  })

  it('código inválido ou inexistente dá 404', async () => {
    expect((await appAs(tech).request('/staff/tickets/abc')).status).toBe(404)
    store.get.mockResolvedValue(null)
    expect((await appAs(tech).request('/staff/tickets/TKT-0404')).status).toBe(404)
  })
})
