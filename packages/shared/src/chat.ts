import type { RequestKind } from './request-kind'
import { z } from 'zod'
import { FAQ } from './faq'
import { chatMessageSchema, type ChatSource } from './tickets'

/** Tamanho máximo de uma mensagem digitada no chat. */
export const CHAT_INPUT_MAX = 1000
/** Mensagens anteriores enviadas junto com a pergunta (contexto do LLM). */
export const CHAT_HISTORY_MAX = 20

/** Pedido ao chat. O visitante manda o histórico do navegador; o cliente logado também manda o `conversationId`. */
export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { error: 'Escreva a sua mensagem.' })
    .max(CHAT_INPUT_MAX, { error: `Use no máximo ${CHAT_INPUT_MAX} caracteres.` }),
  history: z.array(chatMessageSchema).max(CHAT_HISTORY_MAX).default([]),
  conversationId: z.uuid().optional(),
  /** Resposta pronta escolhida no atendimento guiado: a API responde direto por ela, sem LLM. */
  faqId: z
    .string()
    .refine((id) => FAQ.some((entry) => entry.id === id), {
      error: 'Resposta pronta desconhecida.',
    })
    .optional(),
})
export type ChatRequest = z.infer<typeof chatRequestSchema>

/**
 * Origem da resposta: base de FAQ, LLM ou `fallback` (sem resposta pronta e LLM indisponível).
 * No banco, `fallback` é gravado com `source` nulo.
 */
export type ChatReplySource = ChatSource | 'fallback'

/** Eventos da resposta do chat, um JSON por linha (NDJSON). */
export type ChatEvent =
  | { type: 'start'; source: ChatReplySource; faqId?: string }
  | { type: 'delta'; text: string }
  | {
      type: 'end'
      conversationId?: string
      /** Título e tipo da conversa, quando ela acabou de ser criada no servidor. */
      title?: string
      kind?: RequestKind | null
    }
  | { type: 'error'; message: string }

export const CHAT_FALLBACK_REPLY =
  'Não encontrei uma resposta pronta para isso. Para um técnico olhar o seu caso, abra um chamado e conte o que está acontecendo.'

export const CHAT_ERROR_REPLY =
  'Não consegui responder agora. Tente de novo em instantes ou abra um chamado.'
