import type {
  Assignee,
  StaffMetrics,
  StaffQueue,
  StaffTicketDetail,
  StaffTicketSummary,
  TicketPriority,
  TicketStatus,
  UpdateTicketInput,
} from '@f-desk/shared'
import { apiFetch } from '../../lib/api'

export interface QueueQuery {
  queue: StaffQueue
  priority?: TicketPriority
  search?: string
  page: number
  pageSize: number
}

/** Dashboard da equipe. As regras (perfis, transições, responsáveis) ficam na API. */
export const staffApi = {
  metrics: () => apiFetch<StaffMetrics>('/staff/metrics'),
  assignees: () => apiFetch<{ assignees: Assignee[] }>('/staff/assignees'),
  list: (q: QueueQuery) => {
    const params = new URLSearchParams({
      queue: q.queue,
      page: String(q.page),
      pageSize: String(q.pageSize),
    })
    if (q.priority) params.set('priority', q.priority)
    if (q.search?.trim()) params.set('search', q.search.trim())
    return apiFetch<{ tickets: StaffTicketSummary[]; total: number }>(`/staff/tickets?${params}`)
  },
  get: (code: string) => apiFetch<StaffTicketDetail>(`/staff/tickets/${encodeURIComponent(code)}`),
  reply: (code: string, content: string, internal: boolean) =>
    apiFetch<{ status: TicketStatus; assigneeId: string | null }>(
      `/staff/tickets/${encodeURIComponent(code)}/messages`,
      { method: 'POST', body: JSON.stringify({ content, internal }) },
    ),
  update: (code: string, input: UpdateTicketInput) =>
    apiFetch<{ ok: true }>(`/staff/tickets/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
}
