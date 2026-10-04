import {
  CHAT_HISTORY_MAX,
  CHAT_MESSAGE_MAX,
  FAQ,
  GUIDED_FEEDBACK,
  GUIDED_FLOWS,
  GUIDED_OTHER,
  type ChatEvent,
  type ChatMessage,
  type ConversationStatus,
  type FaqCategory,
  type TicketStatus,
  type ChatReplySource,
  type RequestKind,
  type TicketActionProposal,
  type TicketChoice,
  type TicketProposal,
  type ToolActivity,
  ticketCreatedReply,
} from '@f-desk/shared'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { streamChat } from '../features/chat/chat-api'
import { conversationsApi, ticketsApi } from '../features/tickets/tickets-api'

export interface ChatEntry {
  id: string
  role: ChatMessage['role']
  content: string
  source?: ChatReplySource
  /** Resposta ainda chegando. */
  pending?: boolean
  /** A resposta falhou; não volta para o histórico enviado ao chat. */
  failed?: boolean
  /** Passo do atendimento guiado montado no navegador: não vai para a API nem para o LLM. */
  local?: boolean
  /** Opções do atendimento guiado sob a bolha do Wen (`faqId` ou `OTHER_OPTION`). */
  options?: { id: string; label: string }[]
  /** Opção escolhida; a lista some depois da escolha. */
  chosen?: string
  /** Depois de uma resposta pronta: "Isso resolveu?" e o que a pessoa respondeu. */
  feedback?: 'pending' | 'resolved' | 'unresolved'
  /** Quando a mensagem foi enviada (ISO). Falta nas conversas guardadas antes do horário existir. */
  createdAt?: string
  /** Chamado que o Wen preparou nesta resposta: só é aberto quando o cliente confirma. */
  proposal?: ProposalState
  /** Fala que registra o chamado aberto pela conversa (gravada no servidor, com o cartão). */
  ticket?: { code: string; subject: string }
  /** Ação num chamado do cliente que a Wen preparou nesta resposta: só acontece se ele confirmar. */
  action?: ActionState
  /** O que a Wen fez com as ferramentas nesta resposta (consultou, preparou…), na ordem. */
  tools?: ToolActivity[]
  /** Chamados que a Wen listou para a pessoa escolher, e o escolhido. */
  ticketList?: TicketChoice[]
  ticketChosen?: string
}

/** Proposta de ação da Wen e o que aconteceu com ela (fica só no navegador, como a de chamado). */
export type ActionState = TicketActionProposal & {
  /** `replaced`: outra ação veio depois; some da tela. */
  state: 'pending' | 'done' | 'dismissed' | 'replaced'
}

export interface ProposalState extends TicketProposal {
  /** `replaced`: outra proposta veio depois (ou o chamado já foi aberto); some da tela. */
  state: 'pending' | 'created' | 'dismissed' | 'replaced'
  /** Código do chamado aberto a partir da proposta. */
  code?: string
}

/** A proposta de ação que veio no evento, sem o `type` do NDJSON. */
function actionOf(
  event: Extract<ChatEvent, { type: 'ticket-action-proposal' }>,
): TicketActionProposal {
  return event.action === 'reply'
    ? { action: 'reply', code: event.code, subject: event.subject, message: event.message }
    : { action: event.action, code: event.code, subject: event.subject }
}

/** Limite de mensagens da transcrição que vai junto com o chamado (o mesmo da API). */
const TRANSCRIPT_MAX = 100

/** Opção "Outro assunto" do atendimento guiado: libera o texto livre. */
export const OTHER_OPTION = 'outro'

interface Persisted {
  ownerId: string | null
  conversationId?: string
  /** Parte da conversa não está gravada no servidor (começou antes do login). */
  partial?: boolean
  status?: ConversationStatus
  messages: ChatEntry[]
}

const STORAGE_KEY = 'f-desk:chat'

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : null
  } catch {
    return null
  }
}

let nextId = 0
const newId = () => `${Date.now().toString(36)}-${(nextId++).toString(36)}`
const now = () => new Date().toISOString()

/**
 * Conversa com a Wen. Fica no navegador (`localStorage`) para sobreviver a recarregar a página e
 * para seguir junto com o chamado; de quem está logado, a API também grava no banco.
 */
export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatEntry[]>([])
  const conversationId = ref<string>()
  const ownerId = ref<string | null>(null)
  const partial = ref(false)
  const sending = ref(false)
  const notice = ref('')
  /** Conversa salva sendo aberta pela sidebar. */
  const loading = ref(false)
  /** Título e tipo dados pelo bot à conversa nova (para a lista da sidebar). */
  const meta = ref<{ title: string; kind: RequestKind | null } | null>(null)
  /** Chamados abertos a partir da conversa salva (status no cabeçalho). */
  const tickets = ref<{ code: string; status: TicketStatus }[]>([])
  /** Em andamento até o cliente marcar "Resolveu"; volta a aberta se ele escrever de novo. */
  const status = ref<ConversationStatus>('open')

  /** Carrega a conversa salva. A de outra conta é descartada; a do visitante segue após o login. */
  function hydrate(userId: string | null) {
    const saved = load()
    const sameOwner = saved && (saved.ownerId === userId || saved.ownerId === null)
    messages.value = sameOwner ? saved.messages.filter((m) => !m.pending) : []
    const keepsId = sameOwner && saved.ownerId === userId
    conversationId.value = keepsId ? saved.conversationId : undefined
    status.value = (sameOwner && saved.status) || 'open'
    // Conversa do visitante que segue após o login: o começo não está no servidor.
    partial.value = keepsId ? Boolean(saved.partial) : messages.value.some((m) => !m.local)
    ownerId.value = userId
    // Grava já: a conversa passa a ser desta conta antes de qualquer troca de usuário.
    persist()
  }

  function persist() {
    try {
      const data: Persisted = {
        ownerId: ownerId.value,
        conversationId: conversationId.value,
        partial: partial.value,
        status: status.value,
        messages: messages.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Sem armazenamento (aba anônima, bloqueio): a conversa só dura enquanto a página estiver aberta.
    }
  }

  watch([messages, conversationId, ownerId, partial, status], persist, { deep: true })

  /** O que vai para a API como contexto e, na tarefa de chamados, junto com o chamado. */
  const transcript = computed<ChatMessage[]>(() =>
    messages.value
      .filter((m) => !m.local && !m.pending && !m.failed && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.slice(0, CHAT_MESSAGE_MAX) })),
  )

  /** Envia ao chat. Com `faqId` (opção do atendimento guiado) a API responde pela resposta pronta, sem LLM. */
  async function send(text: string, options: { faqId?: string } = {}) {
    const message = text.trim()
    if (!message || sending.value) return false
    notice.value = ''
    const history = transcript.value.slice(-CHAT_HISTORY_MAX)
    messages.value.push({ id: newId(), role: 'user', content: message, createdAt: now() })
    messages.value.push({ id: newId(), role: 'assistant', content: '', pending: true })
    // Mensagem nova reabre a conversa (o servidor faz o mesmo).
    status.value = 'open'
    // Sempre o objeto reativo dentro do array, para as mudanças aparecerem na tela.
    const reply = messages.value[messages.value.length - 1]!
    sending.value = true
    // Conversa sendo levada para a conta: a mensagem vai para ela, não para uma conversa nova.
    if (importing) await importing

    const result = await streamChat(
      { message, history, conversationId: conversationId.value, faqId: options.faqId },
      (event) => {
        if (event.type === 'start') reply.source = event.source
        else if (event.type === 'delta') reply.content += event.text
        else if (event.type === 'end') {
          // Primeira gravação depois de mensagens que ficaram só no navegador.
          if (
            event.conversationId &&
            !conversationId.value &&
            messages.value.filter((m) => !m.local).length > 2
          )
            partial.value = true
          if (event.conversationId) conversationId.value = event.conversationId
          if (event.title) meta.value = { title: event.title, kind: event.kind ?? null }
          reply.createdAt = now()
          reply.pending = false
        } else if (event.type === 'tool') {
          // A mesma chamada chega como `running` e depois com o resultado: atualiza no lugar.
          const activity: ToolActivity = {
            id: event.id,
            tool: event.tool,
            status: event.status,
            ...(event.code ? { code: event.code } : {}),
            ...(event.scope ? { scope: event.scope } : {}),
            ...(event.count !== undefined ? { count: event.count } : {}),
          }
          const tools = reply.tools ?? []
          const index = tools.findIndex((t) => t.id === activity.id)
          reply.tools =
            index === -1 ? [...tools, activity] : tools.map((t, i) => (i === index ? activity : t))
        } else if (event.type === 'ticket-list') {
          reply.ticketList = event.tickets
        } else if (event.type === 'ticket-action-proposal') {
          // Uma ação à espera de cada vez: a mais nova substitui a anterior.
          replacePendingAction()
          reply.action = { ...actionOf(event), state: 'pending' }
        } else if (event.type === 'ticket-proposal') {
          // Só uma proposta fica à espera: a mais nova substitui a anterior.
          replacePending()
          reply.proposal = {
            subject: event.subject,
            description: event.description,
            state: 'pending',
          }
        } else {
          reply.content = event.message
          reply.failed = true
          reply.createdAt = now()
          reply.pending = false
        }
      },
    ).catch(() => ({
      ok: false as const,
      status: 0,
      error: 'A resposta foi interrompida. Tente de novo.',
    }))

    sending.value = false
    if (!result.ok) {
      // Nada chegou: tira a pergunta e a resposta vazia e devolve o texto para o campo.
      messages.value.splice(messages.value.length - 2, 2)
      notice.value = result.error
      return false
    }
    reply.pending = false
    // Resposta pronta: o Wen pergunta se resolveu.
    if (reply.source === 'faq' && !reply.failed) reply.feedback = 'pending'
    return true
  }

  function local(role: ChatEntry['role'], content: string, extra: Partial<ChatEntry> = {}) {
    messages.value.push({ id: newId(), role, content, local: true, createdAt: now(), ...extra })
  }

  /** Começa o atendimento guiado: a categoria vira a fala do cliente e o Wen mostra as opções. */
  function startFlow(category: FaqCategory) {
    if (sending.value) return
    const flow = GUIDED_FLOWS[category]
    local('user', flow.label)
    local('assistant', flow.intro, {
      options: [
        ...FAQ.filter((e) => e.category === category).map((e) => ({ id: e.id, label: e.question })),
        { id: OTHER_OPTION, label: GUIDED_OTHER.label },
      ],
    })
  }

  /**
   * Escolha numa lista de opções. Uma pergunta do FAQ vai à API pelo id (resposta pronta, sem LLM);
   * "Outro assunto" só abre o texto livre. Devolve o que aconteceu, para a tela levar o foco.
   */
  async function chooseOption(
    entryId: string,
    optionId: string,
  ): Promise<'sent' | 'other' | 'failed'> {
    const entry = messages.value.find((m) => m.id === entryId)
    const option = entry?.options?.find((o) => o.id === optionId)
    if (!entry || !option || entry.chosen || sending.value) return 'failed'
    entry.chosen = optionId
    if (optionId === OTHER_OPTION) {
      local('user', option.label)
      local('assistant', GUIDED_OTHER.reply)
      return 'other'
    }
    const ok = await send(option.label, { faqId: optionId })
    if (!ok) entry.chosen = undefined
    return ok ? 'sent' : 'failed'
  }

  /**
   * "Resolveu" / "Não resolveu" depois de uma resposta pronta. As duas falas entram na conversa
   * (vão para o LLM como contexto) e, com `save`, ficam gravadas no servidor junto com o status.
   */
  async function giveFeedback(
    entryId: string,
    resolved: boolean,
    options: { save?: boolean } = {},
  ) {
    const entry = messages.value.find((m) => m.id === entryId)
    if (!entry || entry.feedback !== 'pending') return false
    entry.feedback = resolved ? 'resolved' : 'unresolved'
    const answer = resolved ? GUIDED_FEEDBACK.resolved : GUIDED_FEEDBACK.unresolved
    const added: ChatEntry[] = [
      { id: newId(), role: 'user', content: answer.label, createdAt: now() },
      { id: newId(), role: 'assistant', content: answer.reply, createdAt: now() },
    ]
    messages.value.push(...added)
    status.value = resolved ? 'resolved' : 'open'
    if (!options.save || !conversationId.value) return true
    const { data, error } = await conversationsApi.feedback(conversationId.value, resolved)
    if (data) {
      status.value = data.status
      return true
    }
    // Não gravou: desfaz para a pessoa poder responder de novo.
    const ids = new Set(added.map((m) => m.id))
    messages.value = messages.value.filter((m) => !ids.has(m.id))
    entry.feedback = 'pending'
    status.value = 'open'
    notice.value = error
    return false
  }

  /**
   * O cliente confirmou a proposta (do jeito que o Wen escreveu ou ajustada). Abre o chamado pela
   * rota de chamados, que confere o perfil, com a conversa junto. Devolve o erro para o cartão.
   */
  async function confirmProposal(
    entryId: string,
    input: TicketProposal,
  ): Promise<
    { ok: true; code: string } | { ok: false; error: string; fields?: Record<string, string> }
  > {
    const entry = messages.value.find((m) => m.id === entryId)
    if (!entry?.proposal || entry.proposal.state !== 'pending')
      return { ok: false, error: 'Esta proposta não está mais disponível.' }
    // Importação em andamento: o chamado vai com a conversa gravada, sem reenviar a transcrição.
    if (importing) await importing
    const result = await ticketsApi.create({ ...input, ...ticketAttachment.value })
    if (result.error !== null) return { ok: false, error: result.error, fields: result.fields }
    const { code } = result.data
    entry.proposal = { ...input, state: 'created', code }
    // Uma conversa, um chamado: as outras propostas pendentes deixam de valer.
    replacePending()
    tickets.value = [...tickets.value, { code, status: 'open' }]
    // A conversa ligada ao chamado passa a ser a desta tela (a criada com a transcrição, se for o caso).
    if (result.data.conversationId) {
      conversationId.value = result.data.conversationId
      partial.value = false
    }
    // Fica na conversa (não é passo local): o LLM sabe que o chamado já existe e não propõe outro.
    // A API grava a mesma fala na conversa, ligada ao chamado: ao reabrir, o cartão continua aqui.
    messages.value.push({
      id: newId(),
      role: 'assistant',
      content: ticketCreatedReply(code),
      ticket: { code, subject: input.subject },
      createdAt: now(),
    })
    return { ok: true, code }
  }

  function replacePending() {
    for (const m of messages.value)
      if (m.proposal?.state === 'pending') m.proposal = { ...m.proposal, state: 'replaced' }
  }

  function replacePendingAction() {
    for (const m of messages.value)
      if (m.action?.state === 'pending') m.action = { ...m.action, state: 'replaced' }
  }

  /**
   * O cliente confirmou a ação que a Wen preparou. Vai pela rota de chamados, que confere tudo de novo
   * (dono, status, cota): adicionar informação usa `reopen: false`, e chamado resolvido recusa.
   */
  async function confirmAction(
    entryId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const entry = messages.value.find((m) => m.id === entryId)
    const action = entry?.action
    if (!entry || action?.state !== 'pending')
      return { ok: false, error: 'Esta ação não está mais disponível.' }
    const result =
      action.action === 'reply'
        ? await ticketsApi.reply(action.code, action.message, { reopen: false })
        : action.action === 'cancel'
          ? await ticketsApi.cancel(action.code)
          : await ticketsApi.close(action.code)
    if (result.error !== null) return { ok: false, error: result.error }
    entry.action = { ...action, state: 'done' }
    // O cabeçalho da conversa acompanha o status do chamado ligado a ela.
    const status = result.data.status
    tickets.value = tickets.value.map((t) => (t.code === action.code ? { ...t, status } : t))
    return { ok: true }
  }

  /**
   * A pessoa escolheu um chamado da lista da Wen: vira a fala dela, com o código, e a Wen continua
   * sobre ele (consulta pelo código). Devolve false se não deu para enviar.
   */
  async function chooseTicket(entryId: string, code: string) {
    const entry = messages.value.find((m) => m.id === entryId)
    const ticket = entry?.ticketList?.find((t) => t.code === code)
    if (!entry || !ticket || entry.ticketChosen || sending.value) return false
    entry.ticketChosen = code
    const ok = await send(`Quero falar sobre o ${ticket.code}: ${ticket.subject}`)
    if (!ok) entry.ticketChosen = undefined
    return ok
  }

  /** "Agora não" no cartão da ação: fica registrada como descartada. */
  function dismissAction(entryId: string) {
    const entry = messages.value.find((m) => m.id === entryId)
    if (entry?.action?.state === 'pending') entry.action = { ...entry.action, state: 'dismissed' }
  }

  /** "Agora não": a proposta fica registrada como descartada; o cliente pode pedir de novo. */
  function dismissProposal(entryId: string) {
    const entry = messages.value.find((m) => m.id === entryId)
    if (entry?.proposal?.state === 'pending')
      entry.proposal = { ...entry.proposal, state: 'dismissed' }
  }

  let importing: Promise<boolean> | null = null

  /**
   * Conversa do visitante que entrou como cliente (pelo cartão do chamado, por exemplo): vira uma
   * conversa da conta (`POST /conversations/import`, mensagens marcadas como importadas). A partir
   * daí ela aparece na sidebar, o contexto do chat vem do banco e o chamado usa o `conversationId`.
   * Se falhar, a conversa continua parcial (o chamado leva a transcrição) e a importação é tentada
   * de novo na próxima carga. Devolve true quando importou.
   */
  function importPartial(): Promise<boolean> {
    if (importing) return importing
    const history = transcript.value.slice(-TRANSCRIPT_MAX)
    if (!partial.value || conversationId.value || !history.length) return Promise.resolve(false)
    const owner = ownerId.value
    importing = conversationsApi
      .import(history)
      .then(({ data }) => {
        // Trocou de conta ou de conversa no meio do caminho: nada muda aqui.
        if (!data || ownerId.value !== owner || !partial.value || conversationId.value) return false
        conversationId.value = data.conversationId
        partial.value = false
        return true
      })
      .finally(() => {
        importing = null
      })
    return importing
  }

  /** Abre uma conversa gravada no servidor (lista da sidebar). Devolve false se ela não existe para esta conta. */
  async function loadConversation(id: string) {
    if (sending.value) return false
    loading.value = true
    const { data } = await conversationsApi.get(id)
    loading.value = false
    if (!data) return false
    messages.value = data.messages.map((m) => ({
      id: newId(),
      role: m.role,
      content: m.content,
      source: m.source ?? undefined,
      ticket: m.ticket ?? undefined,
      createdAt: m.createdAt,
    }))
    status.value = data.status ?? 'open'
    conversationId.value = data.id
    meta.value = data.title ? { title: data.title, kind: data.kind } : null
    tickets.value = data.tickets
    partial.value = false
    notice.value = ''
    return true
  }

  function reset() {
    messages.value = []
    conversationId.value = undefined
    meta.value = null
    tickets.value = []
    status.value = 'open'
    partial.value = false
    notice.value = ''
  }

  /**
   * O que mandar ao abrir chamado: o id da conversa gravada quando ela está completa no servidor;
   * senão, a transcrição do navegador.
   */
  const ticketAttachment = computed(() =>
    conversationId.value && !partial.value
      ? { conversationId: conversationId.value, transcript: [] as ChatMessage[] }
      : { conversationId: undefined, transcript: transcript.value.slice(-TRANSCRIPT_MAX) },
  )

  return {
    messages,
    conversationId,
    partial,
    sending,
    notice,
    loading,
    meta,
    tickets,
    status,
    transcript,
    ticketAttachment,
    hydrate,
    send,
    startFlow,
    chooseOption,
    giveFeedback,
    confirmProposal,
    dismissProposal,
    confirmAction,
    dismissAction,
    chooseTicket,
    importPartial,
    loadConversation,
    reset,
  }
})
