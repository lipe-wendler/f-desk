import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '../middleware/session'
import { createConversationsRoute, type ConversationStore } from '../routes/conversations'
import { createTicketsRoute, type ClientTicketStore } from '../routes/tickets'

type User = NonNullable<AppEnv['Variables']['user']>
const client = { id: 'c1', role: 'client', banned: false } as User
const tech = { id: 't1', role: 'technician', banned: false } as User

const store = {
  create: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  reply: vi.fn(),
  close: vi.fn(),
} satisfies Record<keyof ClientTicketStore, ReturnType<typeof vi.fn>>
const conversations = { list: vi.fn(), get: vi.fn() } satisfies Record<
  keyof ConversationStore,
  ReturnType<typeof vi.fn>
>

function appAs(user: User | null) {
  return new Hono<AppEnv>()
    .use('*', async (c, next) => {
      c.set('user', user)
      c.set('session', null)
      await next()
    })
    .route('/tickets', createTicketsRoute(store as unknown as ClientTicketStore))
    .route(
      '/conversations',
      createConversationsRoute(conversations as unknown as ConversationStore),
    )
}

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

beforeEach(() => vi.resetAllMocks())

describe('acesso', () => {
  it('visitante recebe 401 e equipe recebe 403', async () => {
    expect((await appAs(null).request('/tickets')).status).toBe(401)
    expect((await appAs(tech).request('/tickets')).status).toBe(403)
    expect((await appAs(tech).request('/conversations')).status).toBe(403)
    expect(store.list).not.toHaveBeenCalled()
  })
})

describe('POST /tickets', () => {
  it('abre o chamado do cliente logado com a conversa', async () => {
    store.create.mockResolvedValue({ id: 'x', code: 'TKT-0007' })
    const conversationId = '11111111-1111-4111-8111-111111111111'
    const res = await appAs(client).request(
      '/tickets',
      json({
        subject: '  Impressora parada ',
        description: 'Não imprime desde ontem.',
        conversationId,
        transcript: [{ role: 'user', content: 'oi' }],
        clientId: 'outra-pessoa',
      }),
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ code: 'TKT-0007' })
    expect(store.create).toHaveBeenCalledWith({
      clientId: 'c1',
      subject: 'Impressora parada',
      description: 'Não imprime desde ontem.',
      conversationId,
      transcript: [{ role: 'user', content: 'oi' }],
    })
  })

  it('valida os campos', async () => {
    const res = await appAs(client).request(
      '/tickets',
      json({ subject: 'a', description: 'curta' }),
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { fields: unknown }).fields).toMatchObject({
      subject: expect.any(String),
      description: expect.any(String),
    })
    expect(store.create).not.toHaveBeenCalled()
  })
})

describe('GET /tickets', () => {
  it('lista os em aberto por padrão e pagina', async () => {
    store.list.mockResolvedValue({ tickets: [], total: 0 })
    await appAs(client).request('/tickets?page=3&pageSize=10')
    expect(store.list).toHaveBeenCalledWith({
      clientId: 'c1',
      scope: 'active',
      limit: 10,
      offset: 20,
    })
    await appAs(client).request('/tickets?scope=done')
    expect(store.list).toHaveBeenLastCalledWith({
      clientId: 'c1',
      scope: 'done',
      limit: 20,
      offset: 0,
    })
    expect((await appAs(client).request('/tickets?scope=tudo')).status).toBe(400)
  })
})

describe('GET /tickets/:code', () => {
  it('404 para código inválido ou chamado de outra pessoa', async () => {
    expect((await appAs(client).request('/tickets/123')).status).toBe(404)
    expect(store.get).not.toHaveBeenCalled()
    store.get.mockResolvedValue(null)
    expect((await appAs(client).request('/tickets/TKT-0001')).status).toBe(404)
    expect(store.get).toHaveBeenCalledWith('c1', 'TKT-0001')
  })

  it('devolve o chamado do cliente', async () => {
    store.get.mockResolvedValue({ code: 'TKT-0001', messages: [] })
    const res = await appAs(client).request('/tickets/TKT-0001')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ code: 'TKT-0001', messages: [] })
  })
})

describe('respostas e encerramento', () => {
  it('responde ignorando `internal` e informa o novo status', async () => {
    store.reply.mockResolvedValue({ ok: true, status: 'in_progress' })
    const res = await appAs(client).request(
      '/tickets/TKT-0001/messages',
      json({ content: ' Ainda não funciona ', internal: true }),
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ status: 'in_progress' })
    expect(store.reply).toHaveBeenCalledWith('c1', 'TKT-0001', 'Ainda não funciona')
  })

  it('chamado fechado recusa resposta e novo encerramento', async () => {
    store.reply.mockResolvedValue({ ok: false, reason: 'closed' })
    store.close.mockResolvedValue({ ok: false, reason: 'closed' })
    expect(
      (await appAs(client).request('/tickets/TKT-0001/messages', json({ content: 'oi' }))).status,
    ).toBe(409)
    expect(
      (await appAs(client).request('/tickets/TKT-0001/close', { method: 'POST' })).status,
    ).toBe(409)
  })

  it('mensagem vazia é recusada e chamado inexistente dá 404', async () => {
    expect(
      (await appAs(client).request('/tickets/TKT-0001/messages', json({ content: '  ' }))).status,
    ).toBe(400)
    store.reply.mockResolvedValue({ ok: false, reason: 'not_found' })
    expect(
      (await appAs(client).request('/tickets/TKT-0001/messages', json({ content: 'oi' }))).status,
    ).toBe(404)
  })

  it('encerra o chamado', async () => {
    store.close.mockResolvedValue({ ok: true })
    const res = await appAs(client).request('/tickets/TKT-0001/close', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(store.close).toHaveBeenCalledWith('c1', 'TKT-0001')
  })
})

describe('conversas', () => {
  it('lista e abre só as do cliente', async () => {
    conversations.list.mockResolvedValue({ conversations: [], total: 0 })
    await appAs(client).request('/conversations?page=2')
    expect(conversations.list).toHaveBeenCalledWith({ userId: 'c1', limit: 20, offset: 20 })

    expect((await appAs(client).request('/conversations/nao-e-uuid')).status).toBe(404)
    conversations.get.mockResolvedValue(null)
    const id = '11111111-1111-4111-8111-111111111111'
    expect((await appAs(client).request(`/conversations/${id}`)).status).toBe(404)
    expect(conversations.get).toHaveBeenCalledWith('c1', id)
  })
})
