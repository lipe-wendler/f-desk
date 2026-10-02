import type {
  ConversationDetail,
  ConversationSummary,
  CreateTicketInput,
  TicketDetail,
  TicketStatus,
  TicketSummary,
} from '@f-desk/shared'
import { apiFetch } from '../../lib/api'

export type TicketScope = 'active' | 'done' | 'all'

/** Chamados e conversas do cliente. As regras de acesso ficam na API. */
export const ticketsApi = {
  list: (scope: TicketScope, page: number, pageSize: number) =>
    apiFetch<{ tickets: TicketSummary[]; total: number }>(
      `/tickets?${new URLSearchParams({ scope, page: String(page), pageSize: String(pageSize) })}`,
    ),
  get: (code: string) => apiFetch<TicketDetail>(`/tickets/${encodeURIComponent(code)}`),
  create: (
    input: Partial<CreateTicketInput> & Pick<CreateTicketInput, 'subject' | 'description'>,
  ) => apiFetch<{ code: string }>('/tickets', { method: 'POST', body: JSON.stringify(input) }),
  reply: (code: string, content: string) =>
    apiFetch<{ status: TicketStatus }>(`/tickets/${encodeURIComponent(code)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  close: (code: string) =>
    apiFetch<{ status: 'closed' }>(`/tickets/${encodeURIComponent(code)}/close`, {
      method: 'POST',
    }),
}

export const conversationsApi = {
  list: (page: number, pageSize: number) =>
    apiFetch<{ conversations: ConversationSummary[]; total: number }>(
      `/conversations?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`,
    ),
  get: (id: string) => apiFetch<ConversationDetail>(`/conversations/${encodeURIComponent(id)}`),
}
