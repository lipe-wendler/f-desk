import { z } from 'zod'

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'waiting_client',
  'resolved',
  'closed',
] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

/** Status e prioridade de todo chamado recém-aberto (a equipe ajusta a prioridade na triagem). */
export const DEFAULT_TICKET_STATUS: TicketStatus = 'open'
export const DEFAULT_TICKET_PRIORITY: TicketPriority = 'medium'

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  waiting_client: 'Aguardando cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

/** Status em que o chamado ainda pede ação de alguém (fila do técnico e "em aberto" do cliente). */
export const ACTIVE_TICKET_STATUSES = [
  'open',
  'in_progress',
  'waiting_client',
] as const satisfies readonly TicketStatus[]

/**
 * Para onde cada status pode ir. `resolved` ainda pode ser reaberto (o cliente responde que não
 * resolveu); `closed` é final, e um problema novo vira outro chamado.
 */
export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ['in_progress', 'waiting_client', 'resolved', 'closed'],
  in_progress: ['open', 'waiting_client', 'resolved', 'closed'],
  waiting_client: ['in_progress', 'resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value)
}

export function isTicketActive(status: TicketStatus): boolean {
  return (ACTIVE_TICKET_STATUSES as readonly TicketStatus[]).includes(status)
}

export function canChangeTicketStatus(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_STATUS_TRANSITIONS[from].includes(to)
}

/** Prefixo do código exibido ao usuário (`TKT-0001`). O código é gerado pelo banco a partir de `number`. */
export const TICKET_CODE_PREFIX = 'TKT-'

/** Mesmo formato da coluna gerada `ticket.code`: no mínimo 4 dígitos, sem cortar números maiores. */
export function formatTicketCode(number: number): string {
  return `${TICKET_CODE_PREFIX}${String(number).padStart(4, '0')}`
}

/** Quem escreveu cada mensagem do chat. */
export const CHAT_ROLES = ['user', 'assistant'] as const
export type ChatRole = (typeof CHAT_ROLES)[number]

/** De onde veio a resposta do assistente: base de perguntas frequentes ou LLM. */
export const CHAT_SOURCES = ['faq', 'llm'] as const
export type ChatSource = (typeof CHAT_SOURCES)[number]

export const CHAT_MESSAGE_MAX = 4000
export const TICKET_MESSAGE_MAX = 5000

/** Mensagem do chat (visitante ou cliente). Usada também para anexar a conversa anônima ao chamado. */
export const chatMessageSchema = z.object({
  role: z.enum(CHAT_ROLES),
  content: z.string().min(1).max(CHAT_MESSAGE_MAX),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, { error: 'Descreva o assunto em poucas palavras.' })
    .max(140, { error: 'Use no máximo 140 caracteres.' }),
  description: z
    .string()
    .trim()
    .min(10, { error: 'Conte um pouco mais sobre o problema.' })
    .max(TICKET_MESSAGE_MAX, { error: `Use no máximo ${TICKET_MESSAGE_MAX} caracteres.` }),
  transcript: z.array(chatMessageSchema).max(100).default([]),
})
export type CreateTicketInput = z.infer<typeof createTicketSchema>

/** Resposta no chamado. `internal` (nota só da equipe) é ignorado pela API quando quem escreve é o cliente. */
export const ticketMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { error: 'Escreva a mensagem.' })
    .max(TICKET_MESSAGE_MAX, { error: `Use no máximo ${TICKET_MESSAGE_MAX} caracteres.` }),
  internal: z.boolean().default(false),
})
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>

/** Alteração feita pela equipe: status, prioridade e responsável (`null` tira o responsável). */
export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES, { error: 'Status inválido.' }),
    priority: z.enum(TICKET_PRIORITIES, { error: 'Prioridade inválida.' }),
    assigneeId: z.string().min(1).nullable(),
  })
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    error: 'Nada para alterar.',
  })
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>
