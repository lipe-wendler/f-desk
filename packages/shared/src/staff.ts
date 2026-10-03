import { z } from 'zod'
import {
  canChangeTicketStatus,
  CLIENT_ONLY_STATUSES,
  isTicketTerminal,
  TICKET_PRIORITIES,
  type TicketCloseReason,
  type TicketPriority,
  type TicketStatus,
  type TicketSummary,
  type TranscriptMessage,
  type UpdateTicketInput,
} from './tickets'

/** Filas do dashboard: em aberto (pedem ação), minhas, sem responsável e encerradas. */
export const STAFF_QUEUES = ['active', 'mine', 'unassigned', 'done', 'all'] as const
export type StaffQueue = (typeof STAFF_QUEUES)[number]

export const STAFF_QUEUE_LABEL: Record<StaffQueue, string> = {
  active: 'Em aberto',
  mine: 'Meus',
  unassigned: 'Sem responsável',
  done: 'Encerrados',
  all: 'Todos',
}

export const staffQueueQuerySchema = z.object({
  queue: z.enum(STAFF_QUEUES).default('active'),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})
export type StaffQueueQuery = z.infer<typeof staffQueueQuerySchema>

export const STAFF_UPDATE_ERRORS = {
  CLOSED: 'Chamado fechado ou cancelado não pode ser alterado.',
  CLIENT_ONLY: 'Só o cliente pode cancelar o chamado.',
  INVALID_TRANSITION: 'Essa mudança de status não é permitida.',
  INVALID_ASSIGNEE: 'Escolha um técnico ou admin ativo.',
} as const
export type StaffUpdateError = keyof typeof STAFF_UPDATE_ERRORS

export interface TicketState {
  status: TicketStatus
  assigneeId: string | null
}

/** O que gravar no chamado: campos novos e as datas de resolução e fechamento. */
export interface TicketChanges {
  status?: TicketStatus
  priority?: TicketPriority
  assigneeId?: string | null
  resolvedAt?: 'now' | null
  closedAt?: 'now'
  closeReason?: TicketCloseReason
}

/**
 * Valida a alteração feita pela equipe e devolve o que mudar. Status igual ao atual não conta
 * como transição; chamado fechado ou cancelado não muda mais, e cancelar é só do cliente. Sair de
 * "Resolvido" limpa a data de resolução; fechar grava que foi a equipe.
 */
export function planTicketUpdate(
  current: TicketState,
  input: UpdateTicketInput,
): { ok: true; changes: TicketChanges } | { ok: false; error: StaffUpdateError } {
  if (isTicketTerminal(current.status)) return { ok: false, error: 'CLOSED' }
  const changes: TicketChanges = {}

  if (input.status && input.status !== current.status) {
    if ((CLIENT_ONLY_STATUSES as readonly TicketStatus[]).includes(input.status)) {
      return { ok: false, error: 'CLIENT_ONLY' }
    }
    if (!canChangeTicketStatus(current.status, input.status)) {
      return { ok: false, error: 'INVALID_TRANSITION' }
    }
    changes.status = input.status
    if (input.status === 'resolved') changes.resolvedAt = 'now'
    else if (current.status === 'resolved') changes.resolvedAt = null
    if (input.status === 'closed') {
      changes.closedAt = 'now'
      changes.closeReason = 'staff'
    }
  }
  if (input.priority) changes.priority = input.priority
  if (input.assigneeId !== undefined) changes.assigneeId = input.assigneeId
  return { ok: true, changes }
}

/**
 * Efeito de uma resposta da equipe. A primeira resposta pública num chamado "Aberto" coloca o
 * chamado em atendimento e, se ninguém assumiu, atribui a quem respondeu. Nota interna não muda nada.
 */
export function staffReplyEffects(
  current: TicketState,
  staffId: string,
  internal: boolean,
): Pick<TicketChanges, 'status' | 'assigneeId'> {
  if (internal || current.status !== 'open') return {}
  return {
    status: 'in_progress',
    ...(current.assigneeId ? {} : { assigneeId: staffId }),
  }
}

// Respostas da API da equipe (datas em ISO 8601).

export interface StaffTicketSummary extends TicketSummary {
  client: { name: string; email: string }
  assignee: { id: string; name: string } | null
}

export interface StaffThreadMessage {
  id: number
  content: string
  internal: boolean
  createdAt: string
  author: { id: string; name: string; role: string | null }
}

export interface StaffTicketDetail extends StaffTicketSummary {
  description: string
  resolvedAt: string | null
  closedAt: string | null
  cancelledAt: string | null
  closeReason: TicketCloseReason | null
  messages: StaffThreadMessage[]
  transcript: TranscriptMessage[]
}

export interface StaffMetrics {
  open: number
  inProgress: number
  waitingClient: number
  unassigned: number
  mine: number
  resolvedThisWeek: number
}

export interface Assignee {
  id: string
  name: string
  role: string
}
