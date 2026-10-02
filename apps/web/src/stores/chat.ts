import {
  CHAT_HISTORY_MAX,
  CHAT_MESSAGE_MAX,
  FAQ,
  GUIDED_FEEDBACK,
  GUIDED_FLOWS,
  GUIDED_OTHER,
  type ChatMessage,
  type ConversationStatus,
  type FaqCategory,
  type TicketStatus,
  type ChatReplySource,
  type RequestKind,
  type TicketProposal,
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
}

export interface ProposalState extends TicketProposal {
  /** `replaced`: outra proposta veio depois (ou o chamado já foi aberto); some da tela. */
  state: 'pending' | 'created' | 'dismissed' | 'replaced'
  /** Código do chamado aberto a partir da proposta. */
  code?: string
}

/** Limite de mensagens da transcrição que vai junto com o chamado (o mesmo da API). */
const TRANSCRIPT_MAX = 100

/** Fala do Wen depois que o chamado é aberto pela proposta. */
export const ticketCreatedReply = (code: string) =>
  `Abri o chamado ${code}. Um técnico vai assumir o caso, e você acompanha as respostas em Meus chamados.`

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
    messages.value.push({
      id: newId(),
      role: 'assistant',
      content: ticketCreatedReply(code),
      createdAt: now(),
    })
    return { ok: true, code }
  }

  function replacePending() {
    for (const m of messages.value)
      if (m.proposal?.state === 'pending') m.proposal = { ...m.proposal, state: 'replaced' }
  }

  /** "Agora não": a proposta fica registrada como descartada; o cliente pode pedir de novo. */
  function dismissProposal(entryId: string) {
    const entry = messages.value.find((m) => m.id === entryId)
    if (entry?.proposal?.state === 'pending')
      entry.proposal = { ...entry.proposal, state: 'dismissed' }
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
    loadConversation,
    reset,
  }
})
