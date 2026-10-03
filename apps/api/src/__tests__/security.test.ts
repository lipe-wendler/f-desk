import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../app'
import { roles } from '../auth/permissions'
import { isBanned, requireRole } from '../middleware/require-role'
import { onApiError } from '../middleware/security'
import type { AppEnv } from '../middleware/session'
import { createConversationsRoute, type ConversationStore } from '../routes/conversations'
import { createStaffRoute, type StaffStore } from '../routes/staff'
import { createTicketsRoute, type ClientTicketStore } from '../routes/tickets'
import type { ConsumeQuota } from '../services/rate-limit'

type User = NonNullable<AppEnv['Variables']['user']>
const clientA = { id: 'cA', role: 'client', banned: false } as User
const tech = { id: 't1', role: 'technician', banned: false } as User

const TRUSTED = 'http://localhost:5173'
const EVIL = 'https://site-malicioso.example'

describe('cabeçalhos de segurança da API', () => {
  it('toda resposta sai com nosniff, sem iframe e com CSP fechada', async () => {
    const res = await app.request('/api/health')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })
})

describe('CSRF', () => {
  it('recusa formulário de outro site', async () => {
    const res = await app.request('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: EVIL },
      body: JSON.stringify({ subject: 'x', description: 'x' }),
    })
    expect(res.status).toBe(403)
  })

  it('aceita o próprio site (segue para a checagem de login)', async () => {
    const res = await app.request('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: TRUSTED },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(401)
  })
})

describe('tamanho do corpo', () => {
  const post = (path: string, size: number) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: TRUSTED },
      body: JSON.stringify({ message: 'x'.repeat(size) }),
    })

  it('recusa corpo grande demais antes de ler', async () => {
    expect((await post('/api/conversations/x/feedback', 600 * 1024)).status).toBe(413)
    expect((await post('/api/tickets', 3 * 1024 * 1024)).status).toBe(413)
  })

  it('abrir chamado aceita a transcrição completa', async () => {
    expect((await post('/api/tickets', 600 * 1024)).status).toBe(401)
  })
})

describe('erro inesperado', () => {
  it('vira 500 genérico, sem detalhe interno', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const boom = new Hono()
      .get('/x', () => {
        throw new Error('senha do banco: hunter2')
      })
      .onError(onApiError)
    const res = await boom.request('/x')
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('hunter2')
    spy.mockRestore()
  })
})

describe('permissões do admin', () => {
  it('não libera /admin/update-user (que contornaria as regras de perfil e desativação)', () => {
    expect(roles.admin.authorize({ user: ['update'] }).success).toBe(false)
    expect(roles.admin.authorize({ user: ['set-role', 'ban', 'set-password'] }).success).toBe(true)
    expect(roles.admin.authorize({ user: ['impersonate'] }).success).toBe(false)
    expect(roles.admin.authorize({ user: ['delete'] }).success).toBe(false)
  })

  it('cliente e técnico não gerenciam usuários', () => {
    expect(roles.client.authorize({ user: ['list'] }).success).toBe(false)
    expect(roles.technician.authorize({ user: ['set-role'] }).success).toBe(false)
  })
})

describe('conta desativada', () => {
  const hour = 60 * 60 * 1000

  it('desativação sem prazo ou com prazo futuro bloqueia; prazo vencido não', () => {
    expect(isBanned({ banned: true, banExpires: null })).toBe(true)
    expect(isBanned({ banned: true, banExpires: new Date(Date.now() + hour) })).toBe(true)
    expect(isBanned({ banned: true, banExpires: new Date(Date.now() - hour) })).toBe(false)
    expect(isBanned({ banned: false })).toBe(false)
  })

  it('requireRole recusa conta desativada', async () => {
    const banned = { ...clientA, banned: true, banExpires: null } as User
    const res = await new Hono<AppEnv>()
      .use('*', async (c, next) => {
        c.set('user', banned)
        await next()
      })
      .get('/x', requireRole('client'), (c) => c.text('ok'))
      .request('/x')
    expect(res.status).toBe(403)
  })
})

const ticketStore = {
  create: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  reply: vi.fn(),
  close: vi.fn(),
} satisfies Record<keyof ClientTicketStore, ReturnType<typeof vi.fn>>
const conversationStore = {
  list: vi.fn(),
  get: vi.fn(),
  feedback: vi.fn(),
  import: vi.fn(),
} satisfies Record<keyof ConversationStore, ReturnType<typeof vi.fn>>
const staffStore = {
  list: vi.fn(),
  metrics: vi.fn(),
  get: vi.fn(),
  reply: vi.fn(),
  update: vi.fn(),
  assignees: vi.fn(),
} satisfies Record<keyof StaffStore, ReturnType<typeof vi.fn>>

function appAs(
  user: User,
  limits: { create?: ConsumeQuota; write?: ConsumeQuota; staff?: ConsumeQuota } = {},
) {
  return new Hono<AppEnv>()
    .use('*', async (c, next) => {
      c.set('user', user)
      c.set('session', null)
      await next()
    })
    .route(
      '/tickets',
      createTicketsRoute(ticketStore as unknown as ClientTicketStore, {
        create: limits.create,
        write: limits.write,
      }),
    )
    .route(
      '/conversations',
      createConversationsRoute(conversationStore as unknown as ConversationStore, {
        write: limits.write,
      }),
    )
    .route('/staff', createStaffRoute(staffStore as unknown as StaffStore, { write: limits.staff }))
}

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

beforeEach(() => vi.resetAllMocks())

describe('dados de outro cliente', () => {
  // Cada rota recebe o id da sessão; o que vem no corpo ou na URL nunca troca o dono.
  it('chamados: toda consulta e escrita usa o cliente da sessão', async () => {
    ticketStore.get.mockResolvedValue(null)
    ticketStore.reply.mockResolvedValue({ ok: false, reason: 'not_found' })
    ticketStore.close.mockResolvedValue({ ok: false, reason: 'not_found' })
    ticketStore.list.mockResolvedValue({ tickets: [], total: 0 })
    const app = appAs(clientA)

    expect((await app.request('/tickets/TKT-0042')).status).toBe(404)
    expect(
      (await app.request('/tickets/TKT-0042/messages', json({ content: 'oi', clientId: 'cB' })))
        .status,
    ).toBe(404)
    expect((await app.request('/tickets/TKT-0042/close', json({ clientId: 'cB' }))).status).toBe(
      404,
    )
    await app.request('/tickets?clientId=cB')

    expect(ticketStore.get).toHaveBeenCalledWith('cA', 'TKT-0042')
    expect(ticketStore.reply).toHaveBeenCalledWith('cA', 'TKT-0042', 'oi')
    expect(ticketStore.close).toHaveBeenCalledWith('cA', 'TKT-0042')
    expect(ticketStore.list).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'cA' }))
  })

  it('conversas: toda consulta e escrita usa o usuário da sessão', async () => {
    const id = '33333333-3333-4333-8333-333333333333'
    conversationStore.get.mockResolvedValue(null)
    conversationStore.feedback.mockResolvedValue(false)
    conversationStore.list.mockResolvedValue({ conversations: [], total: 0 })
    const app = appAs(clientA)

    expect((await app.request(`/conversations/${id}`)).status).toBe(404)
    await app.request(`/conversations/${id}/feedback`, json({ resolved: true, userId: 'cB' }))
    await app.request('/conversations?userId=cB')
    await app.request(
      '/conversations/import',
      json({ transcript: [{ role: 'user', content: 'oi' }], userId: 'cB' }),
    )

    expect(conversationStore.get).toHaveBeenCalledWith('cA', id)
    expect(conversationStore.import).toHaveBeenCalledWith(expect.objectContaining({ userId: 'cA' }))
    for (const call of [
      ...conversationStore.feedback.mock.calls,
      ...conversationStore.list.mock.calls,
      ...conversationStore.import.mock.calls,
    ])
      expect(JSON.stringify(call)).not.toContain('cB')
  })

  it('cliente não alcança as rotas da equipe', async () => {
    const app = appAs(clientA)
    expect((await app.request('/staff/tickets')).status).toBe(403)
    expect((await app.request('/staff/tickets/TKT-0001')).status).toBe(403)
    expect(staffStore.list).not.toHaveBeenCalled()
    expect(staffStore.get).not.toHaveBeenCalled()
  })
})

describe('limite de escrita', () => {
  const blocked: ConsumeQuota = async () => ({ allowed: false, retryAfter: 120 })

  it('abrir chamado tem cota própria por cliente', async () => {
    const keys: string[] = []
    const create: ConsumeQuota = async (key) => {
      keys.push(key)
      return { allowed: false, retryAfter: 120 }
    }
    const res = await appAs(clientA, { create }).request(
      '/tickets',
      json({ subject: 'Impressora', description: 'Não imprime desde ontem.' }),
    )
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('120')
    expect(keys).toEqual(['ticket:user:cA'])
    expect(ticketStore.create).not.toHaveBeenCalled()
  })

  it('responder e encerrar contam na cota de escrita do cliente', async () => {
    const app = appAs(clientA, { write: blocked })
    expect((await app.request('/tickets/TKT-0001/messages', json({ content: 'oi' }))).status).toBe(
      429,
    )
    expect((await app.request('/tickets/TKT-0001/close', json({}))).status).toBe(429)
    expect(ticketStore.reply).not.toHaveBeenCalled()
    expect(ticketStore.close).not.toHaveBeenCalled()
  })

  it('feedback de conversa conta na cota de escrita do cliente', async () => {
    const res = await appAs(clientA, { write: blocked }).request(
      '/conversations/33333333-3333-4333-8333-333333333333/feedback',
      json({ resolved: true }),
    )
    expect(res.status).toBe(429)
    expect(conversationStore.feedback).not.toHaveBeenCalled()
  })

  it('a equipe também tem limite para responder e alterar chamados', async () => {
    const app = appAs(tech, { staff: blocked })
    expect(
      (await app.request('/staff/tickets/TKT-0001/messages', json({ content: 'oi' }))).status,
    ).toBe(429)
    expect(
      (
        await app.request('/staff/tickets/TKT-0001', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ priority: 'high' }),
        })
      ).status,
    ).toBe(429)
    expect(staffStore.reply).not.toHaveBeenCalled()
    expect(staffStore.update).not.toHaveBeenCalled()
  })
})
