import {
  CHAT_HISTORY_MAX,
  CHAT_MESSAGE_MAX,
  type ChatMessage,
  type ChatReplySource,
  type RequestKind,
} from '@f-desk/shared'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { streamChat } from '../features/chat/chat-api'
import { conversationsApi } from '../features/tickets/tickets-api'

export interface ChatEntry {
  id: string
  role: ChatMessage['role']
  content: string
  source?: ChatReplySource
  /** Resposta ainda chegando. */
  pending?: boolean
  /** A resposta falhou; não volta para o histórico enviado ao chat. */
  failed?: boolean
}

interface Persisted {
  ownerId: string | null
  conversationId?: string
  /** Parte da conversa não está gravada no servidor (começou antes do login). */
  partial?: boolean
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

  /** Carrega a conversa salva. A de outra conta é descartada; a do visitante segue após o login. */
  function hydrate(userId: string | null) {
    const saved = load()
    const sameOwner = saved && (saved.ownerId === userId || saved.ownerId === null)
    messages.value = sameOwner ? saved.messages.filter((m) => !m.pending) : []
    const keepsId = sameOwner && saved.ownerId === userId
    conversationId.value = keepsId ? saved.conversationId : undefined
    // Conversa do visitante que segue após o login: o começo não está no servidor.
    partial.value = keepsId ? Boolean(saved.partial) : messages.value.length > 0
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
        messages: messages.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Sem armazenamento (aba anônima, bloqueio): a conversa só dura enquanto a página estiver aberta.
    }
  }

  watch([messages, conversationId, ownerId, partial], persist, { deep: true })

  /** O que vai para a API como contexto e, na tarefa de chamados, junto com o chamado. */
  const transcript = computed<ChatMessage[]>(() =>
    messages.value
      .filter((m) => !m.pending && !m.failed && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.slice(0, CHAT_MESSAGE_MAX) })),
  )

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending.value) return false
    notice.value = ''
    const history = transcript.value.slice(-CHAT_HISTORY_MAX)
    messages.value.push({ id: newId(), role: 'user', content: message })
    messages.value.push({ id: newId(), role: 'assistant', content: '', pending: true })
    // Sempre o objeto reativo dentro do array, para as mudanças aparecerem na tela.
    const reply = messages.value[messages.value.length - 1]!
    sending.value = true

    const result = await streamChat(
      { message, history, conversationId: conversationId.value },
      (event) => {
        if (event.type === 'start') reply.source = event.source
        else if (event.type === 'delta') reply.content += event.text
        else if (event.type === 'end') {
          // Primeira gravação depois de mensagens que ficaram só no navegador.
          if (event.conversationId && !conversationId.value && messages.value.length > 2)
            partial.value = true
          if (event.conversationId) conversationId.value = event.conversationId
          if (event.title) meta.value = { title: event.title, kind: event.kind ?? null }
          reply.pending = false
        } else {
          reply.content = event.message
          reply.failed = true
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
    return true
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
    }))
    conversationId.value = data.id
    meta.value = data.title ? { title: data.title, kind: data.kind } : null
    partial.value = false
    notice.value = ''
    return true
  }

  function reset() {
    messages.value = []
    conversationId.value = undefined
    meta.value = null
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
      : { conversationId: undefined, transcript: transcript.value },
  )

  return {
    messages,
    conversationId,
    partial,
    sending,
    notice,
    loading,
    meta,
    transcript,
    ticketAttachment,
    hydrate,
    send,
    loadConversation,
    reset,
  }
})
