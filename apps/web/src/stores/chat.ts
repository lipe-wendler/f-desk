import {
  CHAT_HISTORY_MAX,
  CHAT_MESSAGE_MAX,
  type ChatMessage,
  type ChatReplySource,
} from '@f-desk/shared'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { streamChat } from '../features/chat/chat-api'

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
  const sending = ref(false)
  const notice = ref('')

  /** Carrega a conversa salva. A de outra conta é descartada; a do visitante segue após o login. */
  function hydrate(userId: string | null) {
    const saved = load()
    const sameOwner = saved && (saved.ownerId === userId || saved.ownerId === null)
    messages.value = sameOwner ? saved.messages.filter((m) => !m.pending) : []
    conversationId.value = sameOwner && saved.ownerId === userId ? saved.conversationId : undefined
    ownerId.value = userId
    // Grava já: a conversa passa a ser desta conta antes de qualquer troca de usuário.
    persist()
  }

  function persist() {
    try {
      const data: Persisted = {
        ownerId: ownerId.value,
        conversationId: conversationId.value,
        messages: messages.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Sem armazenamento (aba anônima, bloqueio): a conversa só dura enquanto a página estiver aberta.
    }
  }

  watch([messages, conversationId, ownerId], persist, { deep: true })

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
          if (event.conversationId) conversationId.value = event.conversationId
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

  function reset() {
    messages.value = []
    conversationId.value = undefined
    notice.value = ''
  }

  return { messages, conversationId, sending, notice, transcript, hydrate, send, reset }
})
