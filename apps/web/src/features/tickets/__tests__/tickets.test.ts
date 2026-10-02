import type { ConversationSummary, TicketDetail, TicketSummary } from '@f-desk/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useChatStore } from '../../../stores/chat'
import { useSessionStore } from '../../../stores/session'
import ConversationsPage from '../ConversationsPage.vue'
import NewTicketPage from '../NewTicketPage.vue'
import TicketPage from '../TicketPage.vue'
import TicketsPage from '../TicketsPage.vue'

vi.mock('../../../lib/auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

const stub = { template: '<div />' }
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** `fetch` simulado por rota: `METHOD /caminho` → resposta. */
function mockApi(routes: Record<string, (body: unknown) => Response>) {
  const calls: { key: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url.replace(/^\/api/, '')}`
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ key, body })
      const match = Object.entries(routes).find(([k]) => key.startsWith(k))
      return match ? match[1](body) : jsonResponse({ error: 'sem rota no teste' }, 500)
    }),
  )
  return calls
}

async function mountAt(component: object, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'chat', component: stub },
      { path: '/chamados', name: 'tickets', component: stub },
      { path: '/chamados/novo', name: 'ticket-new', component: stub },
      { path: '/chamados/:id', name: 'ticket', component: stub },
    ],
  })
  await router.push(path)
  const wrapper = mount(component, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

const summary = (over: Partial<TicketSummary> = {}): TicketSummary => ({
  code: 'TKT-0001',
  subject: 'Impressora parada',
  status: 'open',
  priority: 'medium',
  createdAt: '2026-10-02T12:00:00.000Z',
  updatedAt: '2026-10-02T13:00:00.000Z',
  ...over,
})

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  useSessionStore().user = { id: 'c1', name: 'Ana', email: 'ana@exemplo.com', role: 'client' }
})
afterEach(() => vi.unstubAllGlobals())

describe('TicketsPage', () => {
  it('lista os chamados em aberto e troca de filtro', async () => {
    const calls = mockApi({
      'GET /tickets?': () => jsonResponse({ tickets: [summary()], total: 1 }),
    })
    const { wrapper } = await mountAt(TicketsPage, '/chamados')
    expect(calls[0]!.key).toContain('scope=active')
    expect(wrapper.get('[data-testid="ticket-list"]').text()).toContain('TKT-0001')
    expect(wrapper.text()).toContain('Aberto')

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()
    expect(calls.at(-1)!.key).toContain('scope=done')
  })
})

describe('NewTicketPage', () => {
  it('anexa a conversa do visitante que entrou, abre o chamado e zera o chat', async () => {
    localStorage.setItem(
      'f-desk:chat',
      JSON.stringify({
        ownerId: null,
        messages: [
          { id: '1', role: 'user', content: 'a impressora não imprime' },
          { id: '2', role: 'assistant', content: 'Confira o papel.', source: 'faq' },
        ],
      }),
    )
    const calls = mockApi({ 'POST /tickets': () => jsonResponse({ code: 'TKT-0042' }, 201) })
    const { wrapper, router } = await mountAt(NewTicketPage, '/chamados/novo')
    expect(wrapper.text()).toContain('Anexar a conversa com a Wen (2 mensagens)')

    await wrapper.get('input').setValue('Impressora parada')
    await wrapper.get('textarea').setValue('Não imprime desde ontem à tarde.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(calls[0]!.body).toEqual({
      subject: 'Impressora parada',
      description: 'Não imprime desde ontem à tarde.',
      transcript: [
        { role: 'user', content: 'a impressora não imprime' },
        { role: 'assistant', content: 'Confira o papel.' },
      ],
    })
    expect(router.currentRoute.value.fullPath).toBe('/chamados/TKT-0042')
    expect(useChatStore().messages).toEqual([])
  })

  it('usa a conversa gravada quando ela está completa no servidor', async () => {
    const conversationId = '11111111-1111-4111-8111-111111111111'
    localStorage.setItem(
      'f-desk:chat',
      JSON.stringify({
        ownerId: 'c1',
        conversationId,
        messages: [
          { id: '1', role: 'user', content: 'oi' },
          { id: '2', role: 'assistant', content: 'Olá.' },
        ],
      }),
    )
    const calls = mockApi({ 'POST /tickets': () => jsonResponse({ code: 'TKT-0043' }, 201) })
    const { wrapper } = await mountAt(NewTicketPage, '/chamados/novo')
    await wrapper.get('input').setValue('Assunto ok')
    await wrapper.get('textarea').setValue('Descrição com detalhes.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(calls[0]!.body).toMatchObject({ conversationId, transcript: [] })
  })

  it('valida os campos sem chamar a API', async () => {
    const calls = mockApi({})
    const { wrapper } = await mountAt(NewTicketPage, '/chamados/novo')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Descreva o assunto em poucas palavras.')
    expect(calls).toHaveLength(0)
  })
})

describe('TicketPage', () => {
  const detail = (over: Partial<TicketDetail> = {}): TicketDetail => ({
    ...summary({ status: 'waiting_client' }),
    description: 'Não imprime.',
    resolvedAt: null,
    closedAt: null,
    assigneeName: 'Téo',
    messages: [
      {
        id: 1,
        content: 'Qual o modelo da impressora?',
        createdAt: '2026-10-02T13:00:00.000Z',
        author: { name: 'Téo', fromClient: false },
      },
    ],
    transcript: [{ role: 'user', content: 'a impressora não imprime', source: null }],
    ...over,
  })

  it('mostra a conversa com a equipe, responde e recarrega', async () => {
    let current = detail()
    const calls = mockApi({
      'GET /tickets/TKT-0001': () => jsonResponse(current),
      'POST /tickets/TKT-0001/messages': () => {
        current = detail({ status: 'in_progress' })
        return jsonResponse({ status: 'in_progress' }, 201)
      },
    })
    const { wrapper } = await mountAt(TicketPage, '/chamados/TKT-0001')
    expect(wrapper.get('[data-testid="thread"]').text()).toContain('Qual o modelo da impressora?')
    expect(wrapper.get('[data-testid="status-hint"]').text()).toContain(
      'precisa de uma resposta sua',
    )
    expect(wrapper.text()).toContain('a impressora não imprime')

    await wrapper.get('textarea').setValue('HP LaserJet 400')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(calls.find((c) => c.key.startsWith('POST'))!.body).toEqual({
      content: 'HP LaserJet 400',
    })
    expect(wrapper.text()).toContain('Em atendimento')
  })

  it('chamado fechado não tem campo de resposta', async () => {
    mockApi({ 'GET /tickets/TKT-0001': () => jsonResponse(detail({ status: 'closed' })) })
    const { wrapper } = await mountAt(TicketPage, '/chamados/TKT-0001')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.text()).toContain('Chamado encerrado')
  })

  it('chamado de outra pessoa aparece como não encontrado', async () => {
    mockApi({
      'GET /tickets/TKT-0009': () => jsonResponse({ error: 'Chamado não encontrado.' }, 404),
    })
    const { wrapper } = await mountAt(TicketPage, '/chamados/TKT-0009')
    expect(wrapper.text()).toContain('Chamado não encontrado.')
  })
})

describe('ConversationsPage', () => {
  it('abre a conversa e oferece abrir chamado com ela', async () => {
    const c: ConversationSummary = {
      id: '22222222-2222-4222-8222-222222222222',
      createdAt: '2026-10-02T12:00:00.000Z',
      updatedAt: '2026-10-02T12:05:00.000Z',
      title: null,
      kind: null,
      lastMessage: null,
      firstQuestion: 'meu computador está lento',
      messageCount: 2,
      ticketCode: null,
    }
    mockApi({
      'GET /conversations?': () => jsonResponse({ conversations: [c], total: 1 }),
      [`GET /conversations/${c.id}`]: () =>
        jsonResponse({
          ...c,
          messages: [
            {
              role: 'user',
              content: 'meu computador está lento',
              source: null,
              createdAt: c.createdAt,
            },
            {
              role: 'assistant',
              content: 'Reinicie o computador.',
              source: 'faq',
              createdAt: c.createdAt,
            },
          ],
          tickets: [],
        }),
    })
    const { wrapper } = await mountAt(ConversationsPage, '/conversas')
    await wrapper.get('[data-testid="conversation-list"] button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Reinicie o computador.')
    const link = wrapper
      .findAll('a')
      .find((a) => a.text().includes('Abrir chamado com esta conversa'))!
    expect(link.attributes('href')).toBe(`/chamados/novo?conversa=${c.id}`)
  })
})
