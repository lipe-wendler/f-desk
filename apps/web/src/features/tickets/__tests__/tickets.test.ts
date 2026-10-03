import type { TicketDetail, TicketSummary } from '@f-desk/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSessionStore } from '../../../stores/session'
import { useToast } from '../../../composables/useToast'
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
    cancelledAt: null,
    closeReason: null,
    canCancel: false,
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

  const buttonByText = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper'], text: string) =>
    wrapper.findAll('button').find((b) => b.text() === text)

  it('"Já resolvi" pede confirmação e fecha o chamado como resolvido pelo cliente', async () => {
    let current = detail()
    const calls = mockApi({
      'GET /tickets/TKT-0001': () => jsonResponse(current),
      'POST /tickets/TKT-0001/close': () => {
        current = detail({
          status: 'closed',
          closeReason: 'client_resolved',
          closedAt: '2026-10-03T10:00:00.000Z',
        })
        return jsonResponse({ status: 'closed' })
      },
    })
    const { wrapper } = await mountAt(TicketPage, '/chamados/TKT-0001')
    // "Encerrar chamado" deu lugar ao "Já resolvi".
    expect(buttonByText(wrapper, 'Encerrar chamado')).toBeUndefined()
    await buttonByText(wrapper, 'Já resolvi')!.trigger('click')
    await flushPromises()
    // Nada acontece antes de confirmar.
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
    const dialog = wrapper.get('dialog')
    expect(dialog.text()).toContain('fechado como resolvido por você')

    await buttonByText(wrapper, 'Fechar como resolvido')!.trigger('click')
    await flushPromises()
    expect(calls.filter((c) => c.key === 'POST /tickets/TKT-0001/close')).toHaveLength(1)
    expect(wrapper.get('[data-testid="status-hint"]').text()).toBe(
      'Você fechou este chamado como resolvido.',
    )
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('"Cancelar chamado" só aparece enquanto ninguém da equipe respondeu', async () => {
    mockApi({ 'GET /tickets/TKT-0001': () => jsonResponse(detail({ canCancel: false })) })
    const answered = await mountAt(TicketPage, '/chamados/TKT-0001')
    expect(buttonByText(answered.wrapper, 'Cancelar chamado')).toBeUndefined()
    expect(buttonByText(answered.wrapper, 'Já resolvi')).toBeTruthy()
    answered.wrapper.unmount()

    let current = detail({ status: 'open', messages: [], canCancel: true })
    const calls = mockApi({
      'GET /tickets/TKT-0001': () => jsonResponse(current),
      'POST /tickets/TKT-0001/cancel': () => {
        current = detail({
          status: 'cancelled',
          messages: [],
          cancelledAt: '2026-10-03T10:00:00.000Z',
        })
        return jsonResponse({ status: 'cancelled' })
      },
    })
    const { wrapper } = await mountAt(TicketPage, '/chamados/TKT-0001')
    await buttonByText(wrapper, 'Cancelar chamado')!.trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
    expect(wrapper.get('dialog').text()).toContain('não pode ser reaberto')
    // "Voltar" não cancela nada.
    await buttonByText(wrapper, 'Voltar')!.trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)

    await buttonByText(wrapper, 'Cancelar chamado')!.trigger('click')
    await flushPromises()
    const confirm = wrapper
      .get('dialog')
      .findAll('button')
      .find((b) => b.text() === 'Cancelar chamado')!
    await confirm.trigger('click')
    await flushPromises()
    expect(calls.filter((c) => c.key === 'POST /tickets/TKT-0001/cancel')).toHaveLength(1)
    expect(wrapper.text()).toContain('Cancelado')
    expect(wrapper.get('[data-testid="status-hint"]').text()).toContain(
      'Você cancelou este chamado',
    )
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('se a equipe respondeu antes da confirmação, mostra o erro e recarrega sem o "Cancelar"', async () => {
    let current = detail({ status: 'open', messages: [], canCancel: true })
    mockApi({
      'GET /tickets/TKT-0001': () => jsonResponse(current),
      'POST /tickets/TKT-0001/cancel': () => {
        current = detail({ status: 'in_progress', canCancel: false })
        return jsonResponse(
          {
            error: 'Este chamado não pode mais ser cancelado: a equipe já começou o atendimento.',
            code: 'NOT_CANCELLABLE',
          },
          409,
        )
      },
    })
    const { wrapper } = await mountAt(TicketPage, '/chamados/TKT-0001')
    await buttonByText(wrapper, 'Cancelar chamado')!.trigger('click')
    await flushPromises()
    await wrapper
      .get('dialog')
      .findAll('button')
      .find((b) => b.text() === 'Cancelar chamado')!
      .trigger('click')
    await flushPromises()
    expect(useToast().toasts.value.at(-1)).toMatchObject({
      message: 'Este chamado não pode mais ser cancelado: a equipe já começou o atendimento.',
      tone: 'danger',
    })
    const formButtons = wrapper
      .get('form')
      .findAll('button')
      .map((b) => b.text())
    expect(formButtons).not.toContain('Cancelar chamado')
    expect(formButtons).toContain('Já resolvi')
  })

  it('chamado de outra pessoa aparece como não encontrado', async () => {
    mockApi({
      'GET /tickets/TKT-0009': () => jsonResponse({ error: 'Chamado não encontrado.' }, 404),
    })
    const { wrapper } = await mountAt(TicketPage, '/chamados/TKT-0009')
    expect(wrapper.text()).toContain('Chamado não encontrado.')
  })
})
