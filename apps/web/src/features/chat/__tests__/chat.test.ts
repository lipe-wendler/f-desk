import type { ChatEvent } from '@f-desk/shared'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStore } from '../../../stores/chat'
import { readNdjson } from '../chat-api'

vi.mock('../../../lib/auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

/** Corpo NDJSON entregue em pedaços que cortam as linhas no meio. */
function ndjsonBody(events: ChatEvent[], chunkSize = 7) {
  const text = events.map((e) => `${JSON.stringify(e)}\n`).join('')
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize)
        controller.enqueue(bytes.slice(i, i + chunkSize))
      controller.close()
    },
  })
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn()
  for (const r of responses) fetchMock.mockResolvedValueOnce(r)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const ndjson = (events: ChatEvent[]) =>
  new Response(ndjsonBody(events), { headers: { 'content-type': 'application/x-ndjson' } })

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('readNdjson', () => {
  it('remonta eventos cortados entre pedaços', async () => {
    const events: ChatEvent[] = [
      { type: 'start', source: 'llm' },
      { type: 'delta', text: 'Olá, tudo bem? Vamos ver.' },
      { type: 'end', conversationId: '11111111-1111-4111-8111-111111111111' },
    ]
    const got: ChatEvent[] = []
    await readNdjson(ndjsonBody(events, 5), (e) => got.push(e))
    expect(got).toEqual(events)
  })
})

describe('store do chat', () => {
  it('monta a resposta conforme chega e guarda o id da conversa', async () => {
    const fetchMock = mockFetch(
      ndjson([
        { type: 'start', source: 'llm' },
        { type: 'delta', text: 'Vamos ' },
        { type: 'delta', text: 'ver.' },
        { type: 'end', conversationId: '11111111-1111-4111-8111-111111111111' },
      ]),
    )
    const chat = useChatStore()
    chat.hydrate('u1')
    expect(await chat.send('  meu sistema dá erro  ')).toBe(true)

    expect(chat.messages.map((m) => [m.role, m.content, m.source])).toEqual([
      ['user', 'meu sistema dá erro', undefined],
      ['assistant', 'Vamos ver.', 'llm'],
    ])
    expect(chat.conversationId).toBe('11111111-1111-4111-8111-111111111111')
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({
      message: 'meu sistema dá erro',
      history: [],
    })
  })

  it('envia o histórico e o id da conversa na mensagem seguinte', async () => {
    const fetchMock = mockFetch(
      ndjson([
        { type: 'start', source: 'faq' },
        { type: 'delta', text: 'R1' },
        { type: 'end', conversationId: '22222222-2222-4222-8222-222222222222' },
      ]),
      ndjson([{ type: 'start', source: 'llm' }, { type: 'delta', text: 'R2' }, { type: 'end' }]),
    )
    const chat = useChatStore()
    chat.hydrate('u1')
    await chat.send('P1')
    await chat.send('P2')
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toEqual({
      message: 'P2',
      history: [
        { role: 'user', content: 'P1' },
        { role: 'assistant', content: 'R1' },
      ],
      conversationId: '22222222-2222-4222-8222-222222222222',
    })
  })

  it('no limite de mensagens, desfaz o envio e mostra o aviso', async () => {
    mockFetch(
      new Response(JSON.stringify({ error: 'Muitas mensagens em pouco tempo.' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '30' },
      }),
    )
    const chat = useChatStore()
    chat.hydrate(null)
    expect(await chat.send('oi')).toBe(false)
    expect(chat.messages).toEqual([])
    expect(chat.notice).toBe('Muitas mensagens em pouco tempo.')
  })

  it('marca a resposta com erro e não a manda de volta como histórico', async () => {
    mockFetch(
      ndjson([
        { type: 'start', source: 'llm' },
        { type: 'error', message: 'Não consegui responder agora.' },
      ]),
    )
    const chat = useChatStore()
    chat.hydrate(null)
    await chat.send('oi')
    expect(chat.messages[1]).toMatchObject({ failed: true, pending: false })
    expect(chat.transcript).toEqual([{ role: 'user', content: 'oi' }])
  })

  it('guarda no navegador; leva a conversa do visitante para o login e descarta a de outra conta', async () => {
    mockFetch(
      ndjson([{ type: 'start', source: 'faq' }, { type: 'delta', text: 'R' }, { type: 'end' }]),
    )
    const visitor = useChatStore()
    visitor.hydrate(null)
    await visitor.send('P')

    setActivePinia(createPinia())
    const afterLogin = useChatStore()
    afterLogin.hydrate('u1')
    expect(afterLogin.messages).toHaveLength(2)

    setActivePinia(createPinia())
    const other = useChatStore()
    other.hydrate('u2')
    expect(other.messages).toEqual([])
  })

  describe('conversa do visitante levada para a conta', () => {
    const IMPORTED = '55555555-5555-4555-8555-555555555555'
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })

    /** Visitante conversa e entra: a conversa volta parcial, sem id. */
    async function visitorThenLogin() {
      mockFetch(
        ndjson([{ type: 'start', source: 'faq' }, { type: 'delta', text: 'R' }, { type: 'end' }]),
      )
      const visitor = useChatStore()
      visitor.hydrate(null)
      await visitor.send('a impressora não imprime')
      setActivePinia(createPinia())
      const chat = useChatStore()
      chat.hydrate('u1')
      return chat
    }

    it('depois do login importa a conversa e passa a usar o id dela', async () => {
      const chat = await visitorThenLogin()
      expect(chat.partial).toBe(true)
      const fetchMock = mockFetch(json({ conversationId: IMPORTED }, 201))

      expect(await chat.importPartial()).toBe(true)
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/conversations/import')
      expect(init.method).toBe('POST')
      expect(JSON.parse(String(init.body))).toEqual({
        transcript: [
          { role: 'user', content: 'a impressora não imprime' },
          { role: 'assistant', content: 'R' },
        ],
      })
      expect(chat.conversationId).toBe(IMPORTED)
      expect(chat.partial).toBe(false)
      // O chamado passa a ir com a conversa gravada, sem reenviar a transcrição.
      expect(chat.ticketAttachment).toEqual({ conversationId: IMPORTED, transcript: [] })
      // Fica guardado: ao recarregar, a conversa segue com o id e não é importada de novo.
      setActivePinia(createPinia())
      const reloaded = useChatStore()
      reloaded.hydrate('u1')
      expect(reloaded.conversationId).toBe(IMPORTED)
      expect(await reloaded.importPartial()).toBe(false)
    })

    it('se a importação falha, a conversa continua parcial (o chamado leva a transcrição)', async () => {
      const chat = await visitorThenLogin()
      mockFetch(json({ error: 'Muitas tentativas em pouco tempo.' }, 429))
      expect(await chat.importPartial()).toBe(false)
      expect(chat.partial).toBe(true)
      expect(chat.conversationId).toBeUndefined()
      expect(chat.ticketAttachment.transcript).toHaveLength(2)

      // Na próxima carga, tenta de novo.
      mockFetch(json({ conversationId: IMPORTED }, 201))
      expect(await chat.importPartial()).toBe(true)
      expect(chat.conversationId).toBe(IMPORTED)
    })

    it('mensagem enviada durante a importação vai para a conversa importada', async () => {
      const chat = await visitorThenLogin()
      let finish!: (r: Response) => void
      const fetchMock = vi.fn()
      fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)))
      fetchMock.mockResolvedValueOnce(
        ndjson([
          { type: 'start', source: 'faq' },
          { type: 'delta', text: 'R2' },
          { type: 'end', conversationId: IMPORTED },
        ]),
      )
      vi.stubGlobal('fetch', fetchMock)

      const imported = chat.importPartial()
      const sent = chat.send('e o scanner também')
      finish(json({ conversationId: IMPORTED }, 201))
      await Promise.all([imported, sent])
      const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body))
      expect(body.conversationId).toBe(IMPORTED)
      expect(chat.partial).toBe(false)
    })

    it('não importa sem conversa parcial nem depois de trocar de conversa', async () => {
      const fetchMock = mockFetch()
      const empty = useChatStore()
      empty.hydrate('u1')
      expect(await empty.importPartial()).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()

      const chat = await visitorThenLogin()
      let finish!: (r: Response) => void
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise<Response>((resolve) => (finish = resolve))),
      )
      const imported = chat.importPartial()
      chat.reset()
      finish(json({ conversationId: IMPORTED }, 201))
      expect(await imported).toBe(false)
      expect(chat.conversationId).toBeUndefined()
    })
  })
})
