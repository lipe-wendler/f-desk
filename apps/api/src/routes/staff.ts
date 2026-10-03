import type {
  addStaffReply,
  getStaffMetrics,
  getStaffTicket,
  listAssignees,
  listStaffTickets,
  updateStaffTicket,
} from '@f-desk/db'
import {
  STAFF_ROLES,
  STAFF_UPDATE_ERRORS,
  TICKET_CODE_PATTERN,
  fieldErrors,
  staffQueueQuerySchema,
  ticketMessageSchema,
  updateTicketSchema,
} from '@f-desk/shared'
import { Hono } from 'hono'
import { requireRole } from '../middleware/require-role'
import type { AppEnv } from '../middleware/session'
import { limitPerUser, type ConsumeQuota } from '../services/rate-limit'

/** Acesso ao banco usado pela rota (injetado para os testes rodarem sem Postgres). */
export interface StaffStore {
  list: typeof listStaffTickets
  metrics: typeof getStaffMetrics
  get: typeof getStaffTicket
  reply: typeof addStaffReply
  update: typeof updateStaffTicket
  assignees: typeof listAssignees
}

const NOT_FOUND = { error: 'Chamado não encontrado.' }

/** Dashboard da equipe (técnico e admin): fila, métricas e atendimento dos chamados. */
export function createStaffRoute(store: StaffStore, limits: { write?: ConsumeQuota } = {}) {
  return new Hono<AppEnv>()
    .use('*', requireRole(...STAFF_ROLES))
    .get('/metrics', async (c) => c.json(await store.metrics(c.get('user')!.id)))
    .get('/assignees', async (c) => c.json({ assignees: await store.assignees() }))
    .get('/tickets', async (c) => {
      const parsed = staffQueueQuerySchema.safeParse(c.req.query())
      if (!parsed.success) return c.json({ error: 'Parâmetros inválidos.' }, 400)
      const { queue, priority, search, page, pageSize } = parsed.data
      const result = await store.list({
        staffId: c.get('user')!.id,
        queue,
        priority,
        search,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      return c.json(result)
    })
    .get('/tickets/:code', async (c) => {
      const code = c.req.param('code')
      if (!TICKET_CODE_PATTERN.test(code)) return c.json(NOT_FOUND, 404)
      const found = await store.get(code)
      return found ? c.json(found) : c.json(NOT_FOUND, 404)
    })
    .post('/tickets/:code/messages', limitPerUser('staff-write', limits.write), async (c) => {
      const code = c.req.param('code')
      if (!TICKET_CODE_PATTERN.test(code)) return c.json(NOT_FOUND, 404)
      const parsed = ticketMessageSchema.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) {
        return c.json({ error: 'Confira a mensagem.', fields: fieldErrors(parsed.error) }, 400)
      }
      const { content, internal } = parsed.data
      const result = await store.reply(c.get('user')!.id, code, content, internal)
      if (!result.ok) {
        if (result.reason === 'not_found') return c.json(NOT_FOUND, 404)
        const reason = result.reason === 'closed' ? 'CLOSED' : 'STALE'
        return c.json({ error: STAFF_UPDATE_ERRORS[reason], code: reason }, 409)
      }
      return c.json({ status: result.status, assigneeId: result.assigneeId }, 201)
    })
    .patch('/tickets/:code', limitPerUser('staff-write', limits.write), async (c) => {
      const code = c.req.param('code')
      if (!TICKET_CODE_PATTERN.test(code)) return c.json(NOT_FOUND, 404)
      const parsed = updateTicketSchema.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) {
        return c.json({ error: parsed.error.issues[0]?.message ?? 'Confira os campos.' }, 400)
      }
      const result = await store.update(code, parsed.data)
      if (result.ok) return c.json({ ok: true })
      if (result.reason === 'not_found') return c.json(NOT_FOUND, 404)
      const status = result.reason === 'INVALID_ASSIGNEE' ? 400 : 409
      return c.json({ error: STAFF_UPDATE_ERRORS[result.reason], code: result.reason }, status)
    })
}
