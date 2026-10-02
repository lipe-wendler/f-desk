import type { TicketDetail, TicketSummary } from '@f-desk/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSessionStore } from '../../../stores/session'
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

    // Chamado novo só pelo atendimento: o botão leva ao Wen.
    const cta = wrapper.findAll('a').find((a) => a.text().includes('Falar com o Wen'))!
    expect(cta.attributes('href')).toBe('/')
    expect(wrapper.text()).not.toContain('Abrir chamado')

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()
    expect(calls.at(-1)!.key).toContain('scope=done')
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
