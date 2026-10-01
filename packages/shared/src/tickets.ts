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

/** Mensagem do chat (visitante ou cliente). Usada também para anexar a conversa anônima ao chamado. */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(5000),
  transcript: z.array(chatMessageSchema).max(100).default([]),
})
export type CreateTicketInput = z.infer<typeof createTicketSchema>
