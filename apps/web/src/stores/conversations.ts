import type { ConversationSummary, RequestKind } from '@f-desk/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { conversationsApi } from '../features/tickets/tickets-api'

export const CONVERSATIONS_PAGE_SIZE = 30

/** Lista de conversas do cliente na sidebar do atendimento: páginas, busca e atualização local. */
export const useConversationsStore = defineStore('conversations', () => {
  const items = ref<ConversationSummary[]>([])
  const total = ref(0)
  const page = ref(0)
  const query = ref('')
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  /** Descarta respostas atrasadas quando a busca muda no meio do caminho. */
  let request = 0

  const hasMore = computed(() => items.value.length < total.value)

  async function fetchPage(next: number) {
    const id = ++request
    loading.value = true
    error.value = ''
    const { data, error: failure } = await conversationsApi.list(
      next,
      CONVERSATIONS_PAGE_SIZE,
      query.value,
    )
    if (id !== request) return
    loading.value = false
    if (!data) {
      error.value = failure
      return
    }
    items.value = next === 1 ? data.conversations : [...items.value, ...data.conversations]
    total.value = data.total
    page.value = next
    loaded.value = true
  }

  /** Primeira página (ou de novo, depois de um erro). */
  function load() {
    return fetchPage(1)
  }

  function loadMore() {
    if (loading.value || !hasMore.value) return Promise.resolve()
    return fetchPage(page.value + 1)
  }

  function search(text: string) {
    query.value = text.trim()
    return fetchPage(1)
  }

  /**
   * Mantém a lista em dia depois de uma troca no chat, sem nova requisição: a conversa sobe para o
   * topo com a última mensagem (ou entra nela, se for nova). Com busca ativa a lista é um filtro e
   * fica como está.
   */
  function touch(change: {
    id: string
    firstQuestion: string
    lastMessage: string
    title?: string
    kind?: RequestKind | null
  }) {
    if (query.value) return
    const now = new Date().toISOString()
    const current = items.value.find((c) => c.id === change.id)
    const updated: ConversationSummary = current
      ? {
          ...current,
          updatedAt: now,
          messageCount: current.messageCount + 2,
          lastMessage: change.lastMessage,
          title: current.title ?? change.title ?? null,
          kind: current.kind ?? change.kind ?? null,
        }
      : {
          id: change.id,
          createdAt: now,
          updatedAt: now,
          title: change.title ?? null,
          kind: change.kind ?? null,
          lastMessage: change.lastMessage,
          firstQuestion: change.firstQuestion,
          messageCount: 2,
          ticketCode: null,
        }
    if (!current) total.value += 1
    items.value = [updated, ...items.value.filter((c) => c.id !== change.id)]
  }

  function reset() {
    request++
    items.value = []
    total.value = 0
    page.value = 0
    query.value = ''
    loading.value = false
    loaded.value = false
    error.value = ''
  }

  return {
    items,
    total,
    query,
    loading,
    loaded,
    error,
    hasMore,
    load,
    loadMore,
    search,
    touch,
    reset,
  }
})
