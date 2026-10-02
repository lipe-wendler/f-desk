import type { ChatMessage } from '@f-desk/shared'
import { streamText, type LanguageModel, type ModelMessage } from 'ai'
import { WEN_INSTRUCTIONS } from './prompt'

/** Mensagens anteriores que vão para o modelo (as mais recentes). */
const HISTORY_LIMIT = 12
const MAX_OUTPUT_TOKENS = 800

/** Nota que vai junto da mensagem atual (e não nas instruções, para o prefixo seguir em cache). */
export function contextNote(loggedIn: boolean) {
  return loggedIn
    ? 'Contexto do sistema: a pessoa já está logada como cliente.'
    : 'Contexto do sistema: a pessoa é visitante, sem login.'
}

/**
 * Resposta da Wen em streaming. Devolve os pedaços de texto conforme chegam e lança o erro
 * do provedor (chave inválida, cota, indisponibilidade) para a rota tratar.
 */
export async function* streamWenReply(
  model: LanguageModel,
  history: ChatMessage[],
  message: string,
  options: { loggedIn: boolean; abortSignal?: AbortSignal },
): AsyncGenerator<string> {
  const messages: ModelMessage[] = [
    ...history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: [
        { type: 'text', text: contextNote(options.loggedIn) },
        { type: 'text', text: message },
      ],
    },
  ]

  const result = streamText({
    model,
    // Só o Anthropic precisa de marcação explícita para cachear o prefixo; os outros cacheiam sozinhos.
    instructions: {
      role: 'system',
      content: WEN_INSTRUCTIONS,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    },
    messages,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    abortSignal: options.abortSignal,
  })

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') yield part.text
    else if (part.type === 'error') throw part.error
  }
}
