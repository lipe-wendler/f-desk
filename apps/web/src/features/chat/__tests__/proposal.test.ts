import {
  ticketCreatedReply,
  type ChatEvent,
  type ChatMessage,
  type ChatRequest,
} from '@f-desk/shared'
import { flushPromises, mount } from '@vue/test-utils'
import axe from 'axe-core'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { authClient } from '../../../lib/auth-client'
import { useChatStore } from '../../../stores/chat'
import { useConversationsStore } from '../../../stores/conversations'
import { useSessionStore, type SessionUser } from '../../../stores/session'
import ChatPage from '../ChatPage.vue'
import { resetAssistantStatus } from '../useAssistantStatus'

vi.mock('../../../lib/auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

const client: SessionUser = { id: 'c1', name: 'Marina Souza', email: 'm@x.com', role: 'client' }
const tech: SessionUser = { id: 't1', name: 'Rafael Lima', email: 'r@x.com', role: 'technician' }
const CONVERSATION = '11111111-1111-4111-8111-111111111111'
const PROPOSAL = {
  subject: 'Erro 503 ao exportar notas fiscais',
  description: 'O cliente recebe erro 503 ao exportar notas fiscais desde ontem.',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const ndjson = (events: ChatEvent[]) =>
  new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(''), {
    headers: { 'content-type': 'application/x-ndjson' },
  })

/** Resposta do LLM que não resolveu: fala do Wen, proposta e fim (com o id para quem está logado). */
const proposalReply = (conversationId?: string): ChatEvent[] => [
  { type: 'start', source: 'llm' },
  { type: 'delta', text: 'Preparei um chamado para a equipe técnica.' },
  { type: 'ticket-proposal', ...PROPOSAL },
  conversationId ? { type: 'end', conversationId } : { type: 'end' },
]

type ChatBody = ChatRequest & { history: ChatMessage[] }

/** Como a API devolve a conversa depois do chamado aberto: a fala do Wen vem ligada ao chamado. */
const savedConversation = {
  id: CONVERSATION,
  title: 'Erro 503 ao exportar notas',
  kind: 'bug',
  status: 'open',
  createdAt: '2026-10-02T12:00:00.000Z',
  updatedAt: '2026-10-02T12:05:00.000Z',
  messages: [
    {
      role: 'user',
      content: 'o sistema de notas mostra erro 503',
      source: null,
      createdAt: '2026-10-02T12:00:00.000Z',
      ticket: null,
    },
    {
      role: 'assistant',
      content: 'Preparei um chamado para a equipe técnica.',
      source: 'llm',
      createdAt: '2026-10-02T12:00:00.000Z',
      ticket: null,
    },
    {
      role: 'assistant',
      content: ticketCreatedReply('TKT-0042'),
      source: null,
      createdAt: '2026-10-02T12:05:00.000Z',
      ticket: { code: 'TKT-0042', subject: PROPOSAL.subject },
    },
  ],
  tickets: [{ code: 'TKT-0042', status: 'open' }],
}

const IMPORTED = '66666666-6666-4666-8666-666666666666'

function mockApi(
  opts: {
    create?: (body: unknown) => Response
    importConversation?: () => Response
    loggedIn?: boolean
  } = {},
) {
  const chatBodies: ChatBody[] = []
  const created: Record<string, unknown>[] = []
  const imported: Record<string, unknown>[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost')
      if (url.pathname === '/api/chat/status') return json({ llm: true })
      if (url.pathname === '/api/tickets' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        created.push(body)
        return (
          opts.create?.(body) ??
          json({ code: 'TKT-0042', conversationId: body.conversationId ?? CONVERSATION }, 201)
        )
      }
      if (url.pathname === '/api/conversations/import' && init?.method === 'POST') {
        imported.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return opts.importConversation?.() ?? json({ conversationId: IMPORTED }, 201)
      }
      if (url.pathname === '/api/tickets') return json({ tickets: [], total: 0 })
      if (url.pathname === '/api/conversations') return json({ conversations: [], total: 0 })
      if (url.pathname === `/api/conversations/${CONVERSATION}`) return json(savedConversation)
      if (url.pathname === '/api/chat') {
        const body = JSON.parse(String(init?.body)) as ChatBody
        chatBodies.push(body)
        return ndjson(proposalReply(opts.loggedIn === false ? undefined : CONVERSATION))
      }
      return json(null)
    }),
  )
  return { chatBodies, created, imported }
}

async function mountPage(user: SessionUser | null) {
  const session = useSessionStore()
  session.user = user
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
      { path: '/tecnico', component: stub },
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
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountPage>>['wrapper']
const buttonByText = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(text))

async function ask(wrapper: Wrapper, text = 'o sistema de notas mostra erro 503 ao exportar') {
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

describe('chamado preparado pelo Wen', () => {
  it('não há botão de abrir chamado fora da conversa com o Wen', async () => {
    mockApi()
    const { wrapper } = await mountPage(client)
    await ask(wrapper)
    // Antes da proposta, o único caminho é conversar: nada de botão no campo de envio.
    expect(wrapper.get('.chat-composer-box').text()).not.toContain('Abrir chamado')
  })

  it('o cliente confere e confirma: o chamado é aberto com a conversa gravada', async () => {
    const { created, chatBodies } = mockApi()
    const { wrapper, router } = await mountPage(client)
    await ask(wrapper)

    // Pendente, o box fica fixo acima do campo de mensagem, fora da lista que rola.
    const dock = wrapper.get('.chat-proposal-docked')
    expect(wrapper.get('[data-testid="chat-messages"]').find('.chat-proposal').exists()).toBe(false)
    expect(
      dock.element.compareDocumentPosition(wrapper.get('.chat-composer-box').element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(dock.text()).toContain('Chamado preparado pelo Wen')
    expect(dock.text()).toContain(PROPOSAL.subject)
    expect(dock.text()).toContain(PROPOSAL.description)
    expect(wrapper.get('[aria-live="polite"]').text()).toContain(
      'Chamado preparado: confira e confirme acima do campo de mensagem.',
    )
    // Nada é aberto sem confirmação.
    expect(created).toHaveLength(0)

    await buttonByText(wrapper, 'Abrir chamado')!.trigger('click')
    await flushPromises()

    expect(created).toEqual([{ ...PROPOSAL, conversationId: CONVERSATION, transcript: [] }])
    // O box sai de baixo e o registro fica na conversa.
    expect(wrapper.find('.chat-proposal-docked').exists()).toBe(false)
    const record = wrapper.get('[data-testid="chat-messages"] .chat-proposal')
    expect(record.text()).toContain('Chamado TKT-0042 aberto')
    expect(record.get('a').attributes('href')).toBe('/chamados/TKT-0042')
    expect(document.activeElement).toBe(wrapper.get('textarea').element)
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('Chamado TKT-0042 aberto.')
    expect(wrapper.text()).toContain('Chamado TKT-0042 · Aberto')
    expect(wrapper.text()).toContain(ticketCreatedReply('TKT-0042'))
    expect(router.currentRoute.value.params.conversa).toBe(CONVERSATION)

    // A fala do chamado aberto vai para o LLM: ele sabe que o chamado já existe.
    await ask(wrapper, 'obrigado')
    expect(chatBodies.at(-1)!.history.at(-1)).toEqual({
      role: 'assistant',
      content: ticketCreatedReply('TKT-0042'),
    })
  })

  it('o chamado aberto continua na conversa ao sair e voltar para ela', async () => {
    mockApi()
    const { wrapper, router } = await mountPage(client)
    await ask(wrapper)
    await buttonByText(wrapper, 'Abrir chamado')!.trigger('click')
    await flushPromises()

    // Sai para uma conversa nova e volta pela URL: a conversa vem do servidor.
    useChatStore().reset()
    await router.push('/atendimento')
    await flushPromises()
    expect(wrapper.find('[data-testid="ticket-created"]').exists()).toBe(false)
    await router.push(`/atendimento/${CONVERSATION}`)
    await flushPromises()

    const card = wrapper.get('[data-testid="ticket-created"]')
    expect(card.text()).toContain('Chamado TKT-0042 aberto')
    expect(card.text()).toContain(PROPOSAL.subject)
    expect(card.get('a').attributes('href')).toBe('/chamados/TKT-0042')
    expect(wrapper.text()).toContain(ticketCreatedReply('TKT-0042'))
    expect(wrapper.text()).toContain('Chamado TKT-0042 · Aberto')
  })

  it('uma proposta nova substitui a anterior: só um box fica à espera', async () => {
    mockApi()
    const { wrapper } = await mountPage(client)
    await ask(wrapper)
    await ask(wrapper, 'esqueci de dizer: acontece desde ontem')
    expect(wrapper.findAll('.chat-proposal')).toHaveLength(1)
    expect(
      useChatStore()
        .messages.map((m) => m.proposal?.state)
        .filter(Boolean),
    ).toEqual(['replaced', 'pending'])
  })

  it('"Ajustar" edita o assunto e a descrição, validando antes de enviar', async () => {
    const { created } = mockApi()
    const { wrapper } = await mountPage(client)
    await ask(wrapper)

    await buttonByText(wrapper, 'Ajustar')!.trigger('click')
    await flushPromises()
    const input = wrapper.get('.chat-proposal input')
    expect(document.activeElement).toBe(input.element)
    expect((input.element as HTMLInputElement).value).toBe(PROPOSAL.subject)

    await input.setValue('x')
    await wrapper.get('.chat-proposal form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Descreva o assunto em poucas palavras.')
    expect(created).toHaveLength(0)

    await input.setValue('Exportação de notas com erro 503')
    await wrapper.get('.chat-proposal form').trigger('submit')
    await flushPromises()
    expect(created[0]).toMatchObject({
      subject: 'Exportação de notas com erro 503',
      description: PROPOSAL.description,
    })
    expect(wrapper.text()).toContain('Chamado TKT-0042 aberto')
  })

  it('se a API recusa, mostra o erro e a proposta continua disponível', async () => {
    mockApi({ create: () => json({ error: 'Não foi possível abrir o chamado.' }, 500) })
    const { wrapper } = await mountPage(client)
    await ask(wrapper)
    await buttonByText(wrapper, 'Abrir chamado')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('.chat-proposal [role="alert"]').text()).toContain(
      'Não foi possível abrir o chamado.',
    )
    expect(buttonByText(wrapper, 'Abrir chamado')).toBeTruthy()
    expect(useChatStore().tickets).toEqual([])
  })

  it('"Agora não" descarta a proposta sem abrir nada', async () => {
    const { created } = mockApi()
    const { wrapper } = await mountPage(client)
    await ask(wrapper)
    await buttonByText(wrapper, 'Agora não')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.chat-proposal-docked').exists()).toBe(false)
    expect(wrapper.get('[data-testid="chat-messages"] .chat-proposal').text()).toContain(
      'Proposta de chamado descartada',
    )
    expect(document.activeElement).toBe(wrapper.get('textarea').element)
    expect(buttonByText(wrapper, 'Abrir chamado')).toBeUndefined()
    expect(created).toHaveLength(0)
  })

  it('visitante é convidado a criar a conta, com a proposta guardada para depois', async () => {
    const { created } = mockApi({ loggedIn: false })
    const { wrapper } = await mountPage(null)
    await ask(wrapper)
    const card = wrapper.get('.chat-proposal')
    expect(card.text()).toContain(
      'Crie sua conta para abrirmos o chamado. Sua conversa com a Wen fica guardada.',
    )
    expect(card.text()).not.toContain('equipe')
    expect(buttonByText(wrapper, 'Abrir chamado')).toBeUndefined()
    // "Criar conta" é a ação principal; "Já tenho conta", a secundária.
    const links = card.findAll('a')
    expect(links.map((a) => a.text())).toEqual(['Criar conta', 'Já tenho conta'])
    expect(links.map((a) => a.attributes('href'))).toEqual([
      '/criar-conta?redirect=/atendimento&motivo=chamado',
      '/entrar?redirect=/atendimento&motivo=chamado',
    ])
    expect(links[0]!.classes().join(' ')).not.toContain('secondary')
    expect(links[1]!.classes().join(' ')).toContain('secondary')
    expect(created).toHaveLength(0)
    // A proposta pendente fica no navegador para quando ele voltar logado.
    const saved = JSON.parse(localStorage.getItem('f-desk:chat')!) as {
      messages: { proposal?: { state: string } }[]
    }
    expect(saved.messages.some((m) => m.proposal?.state === 'pending')).toBe(true)
  })

  it('depois do cadastro, a conversa vira da conta e o chamado usa o id dela', async () => {
    const { created, imported } = mockApi({ loggedIn: false })
    const { wrapper, router } = await mountPage(null)
    await ask(wrapper)

    // Login (o cadastro carrega a sessão e volta para /atendimento): a conversa é importada.
    useSessionStore().user = client
    await flushPromises()
    const chat = useChatStore()
    expect(imported).toEqual([
      {
        transcript: [
          { role: 'user', content: 'o sistema de notas mostra erro 503 ao exportar' },
          { role: 'assistant', content: 'Preparei um chamado para a equipe técnica.' },
        ],
      },
    ])
    expect(chat.conversationId).toBe(IMPORTED)
    expect(chat.partial).toBe(false)
    expect(router.currentRoute.value.params.conversa).toBe(IMPORTED)
    // Entra na sidebar.
    expect(useConversationsStore().items.map((c) => c.id)).toEqual([IMPORTED])

    // A proposta continua à espera e abre com a conversa gravada, sem reenviar a transcrição.
    await buttonByText(wrapper, 'Abrir chamado')!.trigger('click')
    await flushPromises()
    expect(created[0]).toEqual({ ...PROPOSAL, conversationId: IMPORTED, transcript: [] })
  })

  it('se a importação falha, o chamado ainda leva a transcrição', async () => {
    const { created } = mockApi({
      loggedIn: false,
      importConversation: () => json({ error: 'Muitas tentativas.' }, 429),
    })
    const { wrapper } = await mountPage(null)
    await ask(wrapper)
    useSessionStore().user = client
    await flushPromises()
    const chat = useChatStore()
    expect(chat.partial).toBe(true)
    expect(chat.conversationId).toBeUndefined()

    await buttonByText(wrapper, 'Abrir chamado')!.trigger('click')
    await flushPromises()
    expect(created[0]).toMatchObject({
      ...PROPOSAL,
      transcript: [
        { role: 'user', content: 'o sistema de notas mostra erro 503 ao exportar' },
        { role: 'assistant', content: 'Preparei um chamado para a equipe técnica.' },
      ],
    })
    expect(created[0]!.conversationId).toBeUndefined()
    // A conversa criada com o chamado passa a ser a desta tela.
    expect(chat.conversationId).toBe(CONVERSATION)
    expect(chat.partial).toBe(false)
  })

  it('sessão antiga na memória: a proposta confere a sessão antes de escolher as ações', async () => {
    // Visitante que entrou em outra aba: aqui a tela ainda o vê como visitante.
    const { imported } = mockApi({ loggedIn: false })
    const { wrapper } = await mountPage(null)
    vi.mocked(authClient.getSession).mockResolvedValue({ data: { user: client } } as never)
    await ask(wrapper)
    expect(authClient.getSession).toHaveBeenCalled()
    expect(useSessionStore().user).toMatchObject({ id: client.id, role: 'client' })
    expect(imported).toHaveLength(1)
    expect(buttonByText(wrapper, 'Abrir chamado')).toBeTruthy()
  })

  it('sessão da equipe que acabou não mostra o texto da equipe para o visitante', async () => {
    mockApi({ loggedIn: false })
    const { wrapper } = await mountPage(tech)
    vi.mocked(authClient.getSession).mockResolvedValue({ data: null, error: null } as never)
    await ask(wrapper)
    expect(useSessionStore().user).toBeNull()
    expect(wrapper.text()).not.toContain('conta da equipe')
    // A conversa era da conta que saiu: é descartada, como em qualquer troca de conta.
    expect(useChatStore().messages).toEqual([])
  })

  it('enquanto confere a sessão, o cartão não mostra ação nenhuma', async () => {
    mockApi()
    const { wrapper } = await mountPage(client)
    let finish!: (value: unknown) => void
    vi.mocked(authClient.getSession).mockReturnValue(
      new Promise((resolve) => (finish = resolve)) as never,
    )
    await ask(wrapper)
    const card = wrapper.get('.chat-proposal')
    expect(card.get('[role="status"]').text()).toBe('Conferindo sua conta…')
    expect(card.findAll('button, a').map((b) => b.text())).toEqual([])
    finish({ data: { user: client }, error: null })
    await flushPromises()
    expect(buttonByText(wrapper, 'Abrir chamado')).toBeTruthy()
  })

  it('falha ao conferir a sessão mantém quem já estava logado', async () => {
    mockApi()
    const { wrapper } = await mountPage(client)
    vi.mocked(authClient.getSession).mockRejectedValue(new Error('sem rede'))
    await ask(wrapper)
    expect(useSessionStore().user).toEqual(client)
    expect(buttonByText(wrapper, 'Abrir chamado')).toBeTruthy()
  })

  it('a equipe vê a proposta, mas não abre chamado', async () => {
    mockApi()
    const { wrapper } = await mountPage(tech)
    await ask(wrapper)
    expect(wrapper.get('.chat-proposal').text()).toContain(
      'Você está com uma conta da equipe; chamados são abertos por clientes.',
    )
    expect(wrapper.get('.chat-proposal').text()).not.toContain('Crie sua conta')
    expect(buttonByText(wrapper, 'Abrir chamado')).toBeUndefined()
    await buttonByText(wrapper, 'Fechar')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.chat-proposal-docked').exists()).toBe(false)
  })

  it('o cartão não tem violações detectáveis pelo axe', async () => {
    mockApi()
    const { wrapper } = await mountPage(client)
    await ask(wrapper)
    const results = await axe.run(wrapper.get('.chat-proposal').element, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results.violations).toEqual([])
  })
})
