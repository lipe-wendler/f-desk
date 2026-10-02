import {
  FAQ,
  GUIDED_FEEDBACK,
  GUIDED_FLOWS,
  GUIDED_OTHER,
  type ChatEvent,
  type ChatMessage,
  type ChatRequest,
} from '@f-desk/shared'
import { flushPromises, mount } from '@vue/test-utils'
import axe from 'axe-core'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useChatStore } from '../../../stores/chat'
import { useSessionStore, type SessionUser } from '../../../stores/session'
import ChatPage from '../ChatPage.vue'
import { resetAssistantStatus } from '../useAssistantStatus'

vi.mock('../../../lib/auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

const client: SessionUser = { id: 'c1', name: 'Marina Souza', email: 'm@x.com', role: 'client' }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Corpo NDJSON controlado pelo teste: os eventos só chegam quando `finish` é chamado. */
function pendingStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) })
  return {
    response: new Response(body, { headers: { 'content-type': 'application/x-ndjson' } }),
    finish(events: ChatEvent[]) {
      controller.enqueue(
        new TextEncoder().encode(events.map((e) => `${JSON.stringify(e)}\n`).join('')),
      )
      controller.close()
    },
  }
}

function faqReply(id: string): ChatEvent[] {
  const entry = FAQ.find((e) => e.id === id)!
  return [
    { type: 'start', source: 'faq', faqId: id },
    { type: 'delta', text: entry.answer },
    { type: 'end' },
  ]
}

const ndjson = (events: ChatEvent[]) =>
  new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(''), {
    headers: { 'content-type': 'application/x-ndjson' },
  })

/** fetch falso por URL; `chat` decide a resposta de cada POST /api/chat. */
type ChatBody = ChatRequest & { history: ChatMessage[] }

function mockApi(
  opts: { llm?: boolean; waiting?: number; chat?: (body: ChatBody) => Response } = {},
) {
  const chatBodies: ChatBody[] = []
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost')
    if (url.pathname === '/api/chat/status') return json({ llm: opts.llm ?? true })
    if (url.pathname === '/api/tickets')
      return json({
        tickets: Array.from({ length: opts.waiting ?? 0 }, (_, i) => ({
          code: `TKT-000${i}`,
          status: 'waiting_client',
        })),
        total: opts.waiting ?? 0,
      })
    if (url.pathname === '/api/chat') {
      const body = JSON.parse(String(init?.body)) as ChatBody
      chatBodies.push(body)
      return opts.chat?.(body) ?? ndjson(faqReply(body.faqId ?? 'impressora'))
    }
    return json(null)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, chatBodies }
}

async function mountPage(user: SessionUser | null = null) {
  const session = useSessionStore()
  session.user = user
  session.loaded = true
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/atendimento/:conversa?', name: 'chat', component: ChatPage },
      { path: '/chamados', component: stub },
      { path: '/chamados/novo', name: 'ticket-new', component: stub },
      { path: '/entrar', name: 'sign-in', component: stub },
      { path: '/tecnico', component: stub },
      { path: '/', component: stub },
    ],
  })
  await router.push('/atendimento')
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

const buttonByText = (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], text: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(text))!

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  document.body.innerHTML = ''
  resetAssistantStatus()
})
afterEach(() => vi.unstubAllGlobals())

describe('tela inicial do atendimento', () => {
  it('mostra as três formas de começar, os atalhos e o status do Wen', async () => {
    mockApi({ llm: true })
    const { wrapper } = await mountPage()
    expect(wrapper.get('h1').text()).toBe('Como podemos ajudar você?')
    expect(wrapper.text()).toContain(GUIDED_FLOWS.question.label)
    expect(wrapper.text()).toContain(GUIDED_FLOWS.problem.label)
    expect(wrapper.text()).toContain('Acompanhar uma solicitação')
    expect(wrapper.get('[role="status"]').text()).toContain('Wen disponível')
    expect(wrapper.findAll('[aria-label="Sugestões"] button')).toHaveLength(4)
    // Visitante: acompanhar pede login.
    expect(wrapper.find('a[href="/entrar?redirect=/chamados"]').exists()).toBe(true)
  })

  it('sem LLM, o selo avisa que só há respostas prontas', async () => {
    mockApi({ llm: false })
    const { wrapper } = await mountPage()
    expect(wrapper.get('[role="status"]').text()).toContain('Só respostas prontas')
  })

  it('cliente vê quantos chamados aguardam a resposta dele', async () => {
    mockApi({ waiting: 2 })
    const { wrapper } = await mountPage(client)
    expect(wrapper.text()).toContain('2 aguardando você')
    expect(wrapper.find('a[href="/chamados"]').exists()).toBe(true)
  })

  it('atalho de teclado começa o fluxo, mas não enquanto se digita', async () => {
    const { chatBodies } = mockApi()
    const { wrapper } = await mountPage()
    wrapper
      .get('textarea')
      .element.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }))
    await flushPromises()
    expect(useChatStore().messages).toHaveLength(0)

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }))
    await flushPromises()
    expect(wrapper.text()).toContain(GUIDED_FLOWS.problem.intro)
    expect(chatBodies).toHaveLength(0)
  })
})

describe('atendimento guiado', () => {
  it('a categoria vira a fala do cliente e o Wen lista as perguntas, sem chamar a API', async () => {
    const { chatBodies } = mockApi()
    const { wrapper } = await mountPage()
    await buttonByText(wrapper, GUIDED_FLOWS.question.label).trigger('click')

    const messages = wrapper.get('[data-testid="chat-messages"]')
    expect(messages.find('.chat-bubble-user').text()).toContain(GUIDED_FLOWS.question.label)
    expect(messages.find('.chat-bubble-bot').text()).toContain(GUIDED_FLOWS.question.intro)
    const options = messages.findAll('.chat-option').map((o) => o.text())
    const questions = FAQ.filter((e) => e.category === 'question').map((e) => e.question)
    expect(options).toEqual([...questions, GUIDED_OTHER.label])
    expect(chatBodies).toHaveLength(0)
  })

  it('escolher uma opção pede a resposta pronta pelo id, sem mandar os passos locais', async () => {
    const stream = pendingStream()
    const { chatBodies } = mockApi({ chat: () => stream.response })
    const { wrapper } = await mountPage()
    await buttonByText(wrapper, GUIDED_FLOWS.problem.label).trigger('click')
    await buttonByText(wrapper, 'A impressora não imprime').trigger('click')
    await flushPromises()

    expect(chatBodies[0]).toMatchObject({
      message: 'A impressora não imprime',
      faqId: 'impressora',
    })
    expect(chatBodies[0]!.history).toEqual([])
    // Enquanto a resposta não chega: os três pontos, com texto para leitor de tela.
    expect(wrapper.find('.chat-typing').text()).toBe('Wen está digitando')
    expect(wrapper.find('.chat-option').exists()).toBe(false)

    stream.finish(faqReply('impressora'))
    await flushPromises()
    expect(wrapper.find('.chat-typing').exists()).toBe(false)
    expect(wrapper.text()).toContain('resposta pronta')
    expect(wrapper.text()).toContain(GUIDED_FEEDBACK.question)
    // A resposta inteira vai para a região lida pelos leitores de tela.
    const answer = FAQ.find((e) => e.id === 'impressora')!.answer
    expect(wrapper.get('p[aria-live="polite"]').text()).toBe(`Wen: ${answer}`)
  })

  it('"Não resolveu" responde localmente e devolve o foco ao campo', async () => {
    const { chatBodies } = mockApi()
    const { wrapper } = await mountPage()
    await buttonByText(wrapper, GUIDED_FLOWS.problem.label).trigger('click')
    await buttonByText(wrapper, 'A impressora não imprime').trigger('click')
    await flushPromises()
    await buttonByText(wrapper, GUIDED_FEEDBACK.unresolved.label).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain(GUIDED_FEEDBACK.unresolved.reply)
    expect(wrapper.text()).not.toContain(GUIDED_FEEDBACK.question)
    expect(document.activeElement).toBe(wrapper.get('textarea').element)
    expect(chatBodies).toHaveLength(1)
    // Os passos locais ficam fora do que vai para o LLM.
    expect(useChatStore().transcript.map((m) => m.content)).toEqual([
      'A impressora não imprime',
      FAQ.find((e) => e.id === 'impressora')!.answer,
    ])
  })

  it('"Outro assunto" abre o texto livre sem chamar a API', async () => {
    const { chatBodies } = mockApi()
    const { wrapper } = await mountPage()
    await buttonByText(wrapper, GUIDED_FLOWS.question.label).trigger('click')
    await buttonByText(wrapper, GUIDED_OTHER.label).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(GUIDED_OTHER.reply)
    expect(document.activeElement).toBe(wrapper.get('textarea').element)
    expect(chatBodies).toHaveLength(0)
  })

  it('sugestão da tela inicial vai pelo id da resposta pronta', async () => {
    const { chatBodies } = mockApi()
    const { wrapper } = await mountPage()
    await wrapper.findAll('[aria-label="Sugestões"] button')[0]!.trigger('click')
    await flushPromises()
    expect(chatBodies[0]).toMatchObject({ faqId: 'sem-acesso-conta' })
    expect(wrapper.find('.chat-bubble-user').text()).toContain('Não consigo entrar na minha conta')
  })

  it('"Voltar ao início" começa uma conversa nova', async () => {
    mockApi()
    const { wrapper } = await mountPage()
    await buttonByText(wrapper, GUIDED_FLOWS.question.label).trigger('click')
    await buttonByText(wrapper, 'Voltar ao início').trigger('click')
    await flushPromises()
    expect(useChatStore().messages).toHaveLength(0)
    expect(wrapper.get('h1').text()).toBe('Como podemos ajudar você?')
  })

  it('tela inicial e conversa guiada não têm violações detectáveis pelo axe', async () => {
    mockApi()
    const { wrapper } = await mountPage(client)
    const rules = { 'color-contrast': { enabled: false } }
    const home = await axe.run(wrapper.element as HTMLElement, { rules })
    expect(home.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    await buttonByText(wrapper, GUIDED_FLOWS.problem.label).trigger('click')
    await buttonByText(wrapper, 'A impressora não imprime').trigger('click')
    await flushPromises()
    const conversation = await axe.run(wrapper.element as HTMLElement, { rules })
    expect(conversation.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
