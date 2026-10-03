import type { ChatEvent, TicketActionProposal } from '@f-desk/shared'
import { flushPromises, mount } from '@vue/test-utils'
import axe from 'axe-core'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { authClient } from '../../../lib/auth-client'
import { useChatStore } from '../../../stores/chat'
import { useSessionStore, type SessionUser } from '../../../stores/session'
import ChatPage from '../ChatPage.vue'
import { resetAssistantStatus } from '../useAssistantStatus'

vi.mock('../../../lib/auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

const client: SessionUser = { id: 'c1', name: 'Marina Souza', email: 'm@x.com', role: 'client' }
const CONVERSATION = '11111111-1111-4111-8111-111111111111'
const SUBJECT = 'Impressora do financeiro não imprime'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const ndjson = (events: ChatEvent[]) =>
  new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(''), {
    headers: { 'content-type': 'application/x-ndjson' },
  })

/** Resposta da Wen que consultou o chamado e preparou uma ação. */
const actionReply = (action: TicketActionProposal): ChatEvent[] => [
  { type: 'start', source: 'llm' },
  { type: 'delta', text: 'Preparei a ação; confirme no cartão abaixo.' },
  { type: 'ticket-action-proposal', ...action },
  { type: 'end', conversationId: CONVERSATION },
]

const REPLY: TicketActionProposal = {
  action: 'reply',
  code: 'TKT-0042',
  subject: SUBJECT,
  message: 'O modelo da impressora é HP LaserJet 400.',
}

function mockApi(
  actions: TicketActionProposal[],
  ticketRoutes: Record<string, () => Response> = {},
) {
  const calls: { key: string; body: unknown }[] = []
  let replies = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost')
      const key = `${init?.method ?? 'GET'} ${url.pathname}`
      const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined
      calls.push({ key, body })
      if (url.pathname === '/api/chat/status') return json({ llm: true })
      if (url.pathname === '/api/chat')
        return ndjson(actionReply(actions[replies++ % actions.length]!))
      if (ticketRoutes[key]) return ticketRoutes[key]()
      if (url.pathname === '/api/conversations') return json({ conversations: [], total: 0 })
      return json(null)
    }),
  )
  return calls
}

async function mountPage() {
  const session = useSessionStore()
  session.user = client
  session.loaded = true
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/atendimento/:conversa?', name: 'chat', component: ChatPage },
      { path: '/chamados', component: stub },
      { path: '/chamados/:id', name: 'ticket', component: stub },
      { path: '/entrar', name: 'sign-in', component: stub },
      { path: '/criar-conta', name: 'sign-up', component: stub },
      { path: '/', component: stub },
    ],
  })
  await router.push('/atendimento')
  await router.isReady()
  const wrapper = mount(
    { template: '<RouterView />' },
    { global: { plugins: [router] }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountPage>>
const buttonByText = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(text))

async function ask(wrapper: Wrapper, text = 'acrescenta no TKT-0042 que é uma HP LaserJet 400') {
  await wrapper.get('textarea').setValue(text)
  await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(authClient.getSession).mockReset()
  setActivePinia(createPinia())
  localStorage.clear()
  resetAssistantStatus()
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ação num chamado preparada pela Wen', () => {
  it('mostra a ação e só envia a informação depois do "Confirmar", sem reabrir resolvido', async () => {
    const calls = mockApi([REPLY], {
      'POST /api/tickets/TKT-0042/messages': () => json({ status: 'in_progress' }, 201),
    })
    const wrapper = await mountPage()
    await ask(wrapper)

    const card = wrapper.get('.chat-proposal-docked[data-testid="ticket-action"]')
    expect(card.text()).toContain('Ação preparada pela Wen')
    expect(card.text()).toContain('Adicionar informação ao TKT-0042')
    expect(card.text()).toContain(SUBJECT)
    expect(card.get('[data-testid="action-message"]').text()).toBe(REPLY.message)
    expect(wrapper.get('[aria-live="polite"]').text()).toContain(
      'Ação no chamado TKT-0042 preparada',
    )
    // Nada é enviado antes da confirmação.
    expect(calls.some((c) => c.key.startsWith('POST /api/tickets'))).toBe(false)

    await buttonByText(wrapper, 'Confirmar')!.trigger('click')
    await flushPromises()
    expect(calls.filter((c) => c.key === 'POST /api/tickets/TKT-0042/messages')).toEqual([
      {
        key: 'POST /api/tickets/TKT-0042/messages',
        body: { content: REPLY.message, reopen: false },
      },
    ])
    // O box sai de baixo e o registro fica na conversa, com o link do chamado.
    expect(wrapper.find('.chat-proposal-docked').exists()).toBe(false)
    const record = wrapper.get('[data-testid="chat-messages"] [data-testid="ticket-action"]')
    expect(record.text()).toContain('Informação adicionada ao TKT-0042')
    expect(record.get('a').attributes('href')).toBe('/chamados/TKT-0042')
    expect(document.activeElement).toBe(wrapper.get('textarea').element)
  })

  it('cancelar e "já resolvi" vão para as rotas de chamados', async () => {
    for (const [action, route, response, done] of [
      [
        'cancel',
        'POST /api/tickets/TKT-0042/cancel',
        { status: 'cancelled' },
        'Chamado TKT-0042 cancelado',
      ],
      [
        'resolve',
        'POST /api/tickets/TKT-0042/close',
        { status: 'closed' },
        'Chamado TKT-0042 fechado como resolvido',
      ],
    ] as const) {
      setActivePinia(createPinia())
      localStorage.clear()
      const calls = mockApi([{ action, code: 'TKT-0042', subject: SUBJECT }], {
        [route]: () => json(response),
      })
      const wrapper = await mountPage()
      await ask(wrapper)
      await buttonByText(wrapper, 'Confirmar')!.trigger('click')
      await flushPromises()
      expect(calls.filter((c) => c.key === route)).toHaveLength(1)
      expect(wrapper.text()).toContain(done)
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })

  it('se a API recusa (chamado resolvido), mostra o motivo e a ação continua à espera', async () => {
    mockApi([REPLY], {
      'POST /api/tickets/TKT-0042/messages': () =>
        json(
          {
            error: 'Este chamado já foi resolvido. Se o problema voltou, abra um novo chamado.',
            code: 'RESOLVED',
          },
          409,
        ),
    })
    const wrapper = await mountPage()
    await ask(wrapper)
    await buttonByText(wrapper, 'Confirmar')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ticket-action"] [role="alert"]').text()).toContain(
      'Este chamado já foi resolvido',
    )
    expect(useChatStore().messages.at(-1)!.action?.state).toBe('pending')
  })

  it('"Agora não" descarta sem chamar a API, e uma ação nova substitui a anterior', async () => {
    const calls = mockApi([REPLY, { action: 'resolve', code: 'TKT-0042', subject: SUBJECT }])
    const wrapper = await mountPage()
    await ask(wrapper)
    await ask(wrapper, 'na verdade já resolveu')
    expect(
      useChatStore()
        .messages.map((m) => m.action?.state)
        .filter(Boolean),
    ).toEqual(['replaced', 'pending'])
    expect(wrapper.findAll('[data-testid="ticket-action"]')).toHaveLength(1)

    await buttonByText(wrapper, 'Agora não')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.chat-proposal-docked').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ação no TKT-0042 descartada')
    expect(calls.some((c) => c.key.startsWith('POST /api/tickets'))).toBe(false)
  })

  it('o cartão não tem violações detectáveis pelo axe', async () => {
    mockApi([REPLY])
    const wrapper = await mountPage()
    await ask(wrapper)
    const results = await axe.run(wrapper.get('[data-testid="ticket-action"]').element, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results.violations).toEqual([])
  })
})
