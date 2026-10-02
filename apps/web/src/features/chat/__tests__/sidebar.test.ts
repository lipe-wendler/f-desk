import type { ChatEvent, ConversationSummary } from '@f-desk/shared'
import { flushPromises, mount } from '@vue/test-utils'
import axe from 'axe-core'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppShellLayout from '../../../layouts/AppShellLayout.vue'
import { useChatStore } from '../../../stores/chat'
import { useConversationsStore } from '../../../stores/conversations'
import { useSessionStore, type SessionUser } from '../../../stores/session'
import ChatPage from '../ChatPage.vue'
import { formatSince } from '../sidebar/recency'

vi.mock('../../../lib/auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

const client: SessionUser = { id: 'c1', name: 'Marina Souza', email: 'm@x.com', role: 'client' }
const tech: SessionUser = { id: 't1', name: 'Téo Lima', email: 't@x.com', role: 'technician' }
const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOW = new Date().toISOString()

function summary(
  id: string,
  firstQuestion: string,
  updatedAt: string,
  extra: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    id,
    createdAt: updatedAt,
    updatedAt,
    title: null,
    kind: null,
    lastMessage: null,
    firstQuestion,
    messageCount: 2,
    ticketCode: null,
    ...extra,
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const ndjson = (events: ChatEvent[]) =>
  new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(''), {
    headers: { 'content-type': 'application/x-ndjson' },
  })

/** fetch falso que responde pela URL; guarda as chamadas para conferir parâmetros. */
function mockApi(handlers: {
  list?: (url: URL) => Response
  get?: (id: string) => Response
  chat?: () => Response
}) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost')
    if (url.pathname === '/api/conversations')
      return handlers.list?.(url) ?? json({ conversations: [], total: 0 })
    if (url.pathname.startsWith('/api/conversations/'))
      return handlers.get?.(url.pathname.split('/').pop()!) ?? json({ error: 'x' }, 404)
    if (url.pathname === '/api/chat') return handlers.chat!()
    return json(null)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const listCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .map(([input]) => new URL(input, 'http://localhost'))
    .filter((url) => url.pathname === '/api/conversations')

async function mountShell(path: string, user: SessionUser | null) {
  const session = useSessionStore()
  session.user = user
  session.loaded = true
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: AppShellLayout,
        children: [{ path: 'atendimento/:conversa?', name: 'chat', component: ChatPage }],
      },
      { path: '/entrar', name: 'sign-in', component: stub },
      { path: '/criar-conta', name: 'sign-up', component: stub },
      { path: '/chamados', component: stub },
      { path: '/tecnico', component: stub },
      { path: '/', component: stub },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(
    { template: '<RouterView />' },
    {
      global: { plugins: [router] },
      attachTo: document.body,
    },
  )
  await flushPromises()
  return { wrapper, router }
}

/** O layout monta a sidebar duas vezes (desktop e drawer); a do desktop é a do <aside>. */
const sidebar = (wrapper: Awaited<ReturnType<typeof mountShell>>['wrapper']) =>
  wrapper.get('aside[aria-label="Conversas"]')

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  document.body.innerHTML = ''
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('tempo desde a última interação', () => {
  const now = new Date(2026, 9, 2, 10, 0)
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

  it('mostra minutos e horas até um dia, depois a data', () => {
    expect(formatSince(ago(20 * 1000), now)).toBe('agora')
    expect(formatSince(ago(4 * 60 * 1000), now)).toBe('há 4 minutos')
    expect(formatSince(ago(3 * 60 * 60 * 1000), now)).toBe('há 3 horas')
    expect(formatSince(new Date(2026, 9, 1, 9, 0).toISOString(), now)).toBe('01/10/2026')
    expect(formatSince('', now)).toBe('')
  })
})

describe('store das conversas', () => {
  it('pagina, busca e sobe a conversa tocada para o topo', async () => {
    const fetchMock = mockApi({
      list: (url) =>
        json({
          conversations: [summary(url.searchParams.get('page') === '1' ? ID_A : ID_B, 'x', NOW)],
          total: 2,
        }),
    })
    const store = useConversationsStore()
    await store.load()
    expect(store.hasMore).toBe(true)
    await store.loadMore()
    expect(store.items.map((c) => c.id)).toEqual([ID_A, ID_B])
    expect(store.hasMore).toBe(false)

    store.touch({ id: ID_B, firstQuestion: 'x', lastMessage: 'Resolvido, obrigado.' })
    expect(store.items[0]).toMatchObject({ id: ID_B, lastMessage: 'Resolvido, obrigado.' })
    store.touch({
      id: 'novo',
      firstQuestion: 'Pergunta nova',
      lastMessage: 'Resposta',
      title: 'Título do bot',
      kind: 'bug',
    })
    expect(store.items[0]).toMatchObject({ id: 'novo', title: 'Título do bot', kind: 'bug' })
    expect(store.total).toBe(3)

    await store.search('vpn')
    expect(listCalls(fetchMock).at(-1)!.searchParams.get('q')).toBe('vpn')
    const before = store.items.map((c) => c.id)
    store.touch({ id: 'outra', firstQuestion: 'y', lastMessage: 'z' })
    // Com busca ativa a lista é um filtro e não muda.
    expect(store.items.map((c) => c.id)).toEqual(before)
  })
})

describe('sidebar do atendimento', () => {
  it('visitante vê o convite para entrar, sem lista', async () => {
    const fetchMock = mockApi({})
    const { wrapper } = await mountShell('/atendimento', null)
    const side = sidebar(wrapper)
    expect(side.text()).toContain('Entre para guardar suas conversas')
    expect(side.find('input[type="search"]').exists()).toBe(false)
    expect(side.find('a[href="/entrar?redirect=/atendimento"]').exists()).toBe(true)
    expect(listCalls(fetchMock)).toHaveLength(0)
  })

  it('técnico vê o aviso e o atalho do dashboard', async () => {
    mockApi({})
    const { wrapper } = await mountShell('/atendimento', tech)
    expect(sidebar(wrapper).text()).toContain('O histórico de conversas é dos clientes')
    expect(sidebar(wrapper).find('a[href="/tecnico"]').exists()).toBe(true)
  })

  it('cliente sem conversas vê o empty state', async () => {
    mockApi({})
    const { wrapper } = await mountShell('/atendimento', client)
    expect(sidebar(wrapper).text()).toContain('Nenhuma conversa ainda')
  })

  it('cliente vê título, última mensagem, tempo e tipo, com a aberta marcada', async () => {
    const today = new Date().toISOString()
    mockApi({
      list: () =>
        json({
          conversations: [
            summary(ID_A, 'Minha impressora parou de imprimir', today, {
              title: 'Impressora não imprime',
              kind: 'bug',
              lastMessage: 'Funcionou, obrigado.',
            }),
            summary(ID_B, 'VPN', today),
          ],
          total: 2,
        }),
      get: (id) => json({ id, createdAt: today, updatedAt: today, messages: [], tickets: [] }),
    })
    const { wrapper } = await mountShell(`/atendimento/${ID_B}`, client)
    const side = sidebar(wrapper)
    const first = side.get(`a[href="/atendimento/${ID_A}"]`)
    expect(first.text()).toContain('Impressora não imprime')
    expect(first.text()).not.toContain('Minha impressora parou')
    expect(first.text()).toContain('Funcionou, obrigado.')
    expect(first.text()).toContain('agora')
    expect(first.text()).toContain('Bug')
    // Conversa antiga sem título: usa a primeira pergunta.
    expect(side.get(`a[href="/atendimento/${ID_B}"]`).text()).toContain('VPN')
    const current = side.findAll('a[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]!.text()).toContain('VPN')
    expect(side.find(`a[href="/atendimento/${ID_A}"]`).exists()).toBe(true)
  })

  it('busca no servidor depois de uma pausa na digitação', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = mockApi({})
    const { wrapper } = await mountShell('/atendimento', client)
    await sidebar(wrapper).get('input[type="search"]').setValue('impressora')
    expect(listCalls(fetchMock)).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(listCalls(fetchMock).at(-1)!.searchParams.get('q')).toBe('impressora')
    expect(sidebar(wrapper).text()).toContain('Nenhuma conversa encontrada')
  })

  it('"Carregar mais" pede a página seguinte', async () => {
    const fetchMock = mockApi({
      list: (url) =>
        json({
          conversations: [summary(url.searchParams.get('page') === '1' ? ID_A : ID_B, 'x', NOW)],
          total: 2,
        }),
    })
    const { wrapper } = await mountShell('/atendimento', client)
    const more = sidebar(wrapper)
      .findAll('button')
      .find((b) => b.text() === 'Carregar mais')!
    await more.trigger('click')
    await flushPromises()
    expect(listCalls(fetchMock).at(-1)!.searchParams.get('page')).toBe('2')
  })

  it('menu da conta mostra perfil, atalhos, tema e sair', async () => {
    mockApi({})
    const { wrapper } = await mountShell('/atendimento', client)
    const side = sidebar(wrapper)
    expect(side.text()).toContain('Marina Souza')
    expect(side.text()).toContain('Cliente')
    expect(side.text()).toContain('MS')
    await side.get('button[aria-label="Configurações da conta"]').trigger('click')
    const items = side.findAll('[role="menuitem"]').map((i) => i.text())
    expect(items).toEqual(['Meus chamados', 'Usar tema claro', 'Sair'])
  })
})

describe('conversa aberta pela rota', () => {
  it('a URL com id carrega a conversa salva', async () => {
    mockApi({
      get: (id) =>
        json({
          id,
          createdAt: '',
          updatedAt: '',
          messages: [
            { role: 'user', content: 'Pergunta antiga', source: null, createdAt: '' },
            { role: 'assistant', content: 'Resposta antiga', source: 'faq', createdAt: '' },
          ],
          tickets: [],
        }),
    })
    const { wrapper } = await mountShell(`/atendimento/${ID_A}`, client)
    const chat = useChatStore()
    expect(chat.conversationId).toBe(ID_A)
    expect(wrapper.get('[data-testid="chat-messages"]').text()).toContain('Resposta antiga')
  })

  it('conversa que não existe volta para o início', async () => {
    mockApi({})
    const { router } = await mountShell(`/atendimento/${ID_A}`, client)
    await flushPromises()
    expect(router.currentRoute.value.params.conversa).toBeFalsy()
  })

  it('a primeira resposta gravada troca a URL e sobe a conversa na lista', async () => {
    mockApi({
      chat: () =>
        ndjson([
          { type: 'start', source: 'llm' },
          { type: 'delta', text: 'Vamos ver.' },
          { type: 'end', conversationId: ID_B, title: 'Impressora parada', kind: 'bug' },
        ]),
      get: (id) => json({ id, createdAt: '', updatedAt: '', messages: [], tickets: [] }),
    })
    const { wrapper, router } = await mountShell('/atendimento', client)
    const textarea = wrapper.get('textarea')
    await textarea.setValue('Minha impressora parou')
    await textarea.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.params.conversa).toBe(ID_B)
    expect(useConversationsStore().items[0]).toMatchObject({
      id: ID_B,
      firstQuestion: 'Minha impressora parou',
      title: 'Impressora parada',
      kind: 'bug',
      lastMessage: 'Vamos ver.',
    })
    expect(sidebar(wrapper).text()).toContain('Impressora parada')
    // A conversa já estava no store: abrir a URL dela não recarrega do servidor.
    expect(wrapper.get('[data-testid="chat-messages"]').text()).toContain('Vamos ver.')
  })
})

describe('layout do atendimento', () => {
  it('abre o drawer e devolve o foco ao botão ao fechar', async () => {
    mockApi({})
    const { wrapper } = await mountShell('/atendimento', client)
    const button = wrapper.get('button[aria-controls="drawer-de-conversas"]')
    await button.trigger('click')
    await flushPromises()
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('dialog#drawer-de-conversas').exists()).toBe(true)

    await wrapper.get('dialog button[aria-label="Fechar conversas"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('dialog#drawer-de-conversas').exists()).toBe(false)
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button.element)
  })

  it('não tem violações de acessibilidade detectáveis pelo axe', async () => {
    mockApi({
      list: () =>
        json({ conversations: [summary(ID_A, 'Impressora', new Date().toISOString())], total: 1 }),
    })
    const { wrapper } = await mountShell('/atendimento', client)
    const result = await axe.run(wrapper.element as HTMLElement, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
