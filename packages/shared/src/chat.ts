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
  /** O Wen não resolveu e preparou um chamado: o cliente confere e confirma (nada é aberto sem ele). */
  | { type: 'ticket-proposal'; subject: string; description: string }
  | { type: 'error'; message: string }

export const CHAT_FALLBACK_REPLY =
  'Não encontrei uma resposta pronta para isso. Preparei um chamado para um técnico olhar o seu caso: confira os dados abaixo e confirme.'

/** Pedido de chamado atendido sem LLM: o chamado sai do que o cliente já contou. */
export const CHAT_TICKET_REQUEST_REPLY =
  'Preparei um chamado para a equipe técnica com o que você contou: confira os dados e confirme.'

/** Pedido de chamado antes de contar o problema (sem LLM): o Wen pergunta antes de preparar. */
export const CHAT_TICKET_DETAILS_REPLY =
  'Posso preparar o chamado. Antes, me conte o que está acontecendo: o que aparece na tela, desde quando e o que você já tentou.'

/** Texto da resposta quando o LLM só propõe o chamado, sem escrever nada antes. */
export const CHAT_PROPOSAL_REPLY =
  'Não consegui resolver por aqui. Preparei um chamado para a equipe técnica: confira os dados abaixo e confirme.'

/** Fala do Wen gravada na conversa quando o chamado é aberto pela proposta. */
export const ticketCreatedReply = (code: string) =>
  `Abri o chamado ${code}. Um técnico vai assumir o caso, e você acompanha as respostas em Meus chamados.`

export const CHAT_ERROR_REPLY = 'Não consegui responder agora. Tente de novo em instantes.'
