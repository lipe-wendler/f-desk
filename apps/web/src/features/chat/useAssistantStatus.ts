import { ref } from 'vue'
import { apiFetch } from '../../lib/api'

/** null enquanto carrega; depois, se o LLM está ligado. Uma consulta por carregamento da página. */
const llm = ref<boolean | null>(null)
let loading: Promise<void> | null = null

/** Status do assistente para o selo do cabeçalho ("Wen disponível" ou "Só respostas prontas"). */
export function useAssistantStatus() {
  loading ??= apiFetch<{ llm: boolean }>('/chat/status').then(({ data }) => {
    llm.value = data?.llm ?? false
  })
  return { llm }
}

/** Só para testes: volta ao estado inicial. */
export function resetAssistantStatus() {
  llm.value = null
  loading = null
}
