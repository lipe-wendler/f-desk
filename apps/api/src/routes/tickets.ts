import type {
  addClientReply,
  cancelClientTicket,
  closeClientTicket,
  createTicket,
  getClientTicket,
  listClientTickets,
} from '@f-desk/db'
import {
  TICKET_CODE_PATTERN,
  clientReplySchema,
  createTicketSchema,
  fieldErrors,
} from '@f-desk/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../middleware/require-role'
import type { AppEnv } from '../middleware/session'
import { limitPerUser, type ConsumeQuota } from '../services/rate-limit'

/** Acesso ao banco usado pela rota (injetado para os testes rodarem sem Postgres). */
export interface ClientTicketStore {
  create: typeof createTicket
  list: typeof listClientTickets
  get: typeof getClientTicket
  reply: typeof addClientReply
  close: typeof closeClientTicket
  cancel: typeof cancelClientTicket
}

/** Limites de escrita (no app são sempre passados; nos testes, só quando o teste é sobre eles). */
export interface ClientTicketLimits {
  /** Chamados abertos por janela. */
  create?: ConsumeQuota
  /** Respostas, encerramentos e cancelamentos por janela. */
  write?: ConsumeQuota
}

const listQuerySchema = z.object({
  scope: z.enum(['active', 'done', 'all']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

const NOT_FOUND = { error: 'Chamado não encontrado.' }
const CLOSED = {
  error: 'Este chamado está encerrado. Se o problema voltou, abra um novo chamado.',
}
/** Informação adicionada pela Wen (`reopen: false`) não reabre chamado resolvido. */
const RESOLVED = {
  error: 'Este chamado já foi resolvido. Se o problema voltou, abra um novo chamado.',
  code: 'RESOLVED',
}
/** O chamado mudou enquanto a resposta era gravada (a equipe alterou ao mesmo tempo). */
const CONFLICT = { error: 'O chamado mudou agora há pouco. Recarregue e tente de novo.' }
const NOT_CANCELLABLE = {
  error: 'Este chamado não pode mais ser cancelado: a equipe já começou o atendimento.',
  code: 'NOT_CANCELLABLE',
}

/**
 * Chamados do cliente: abrir, listar, ver, responder, dizer que resolveu e cancelar. Só o perfil
 * `client`, e só os próprios chamados (de outra pessoa, a resposta é 404). Notas internas da equipe
 * nunca saem daqui. Nada é apagado: cancelar e fechar são status finais.
 */
export function createTicketsRoute(store: ClientTicketStore, limits: ClientTicketLimits = {}) {
  return (
    new Hono<AppEnv>()
      .use('*', requireRole('client'))
      .post('/', limitPerUser('ticket', limits.create), async (c) => {
        const parsed = createTicketSchema.safeParse(await c.req.json().catch(() => null))
        if (!parsed.success) {
          return c.json({ error: 'Confira os campos.', fields: fieldErrors(parsed.error) }, 400)
        }
        const created = await store.create({ ...parsed.data, clientId: c.get('user')!.id })
        return c.json({ code: created.code, conversationId: created.conversationId }, 201)
      })
      .get('/', async (c) => {
        const parsed = listQuerySchema.safeParse(c.req.query())
        if (!parsed.success) return c.json({ error: 'Parâmetros inválidos.' }, 400)
        const { scope, page, pageSize } = parsed.data
        const result = await store.list({
          clientId: c.get('user')!.id,
          scope,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        })
        return c.json(result)
      })
      .get('/:code', async (c) => {
        const code = c.req.param('code')
        if (!TICKET_CODE_PATTERN.test(code)) return c.json(NOT_FOUND, 404)
        const found = await store.get(c.get('user')!.id, code)
        return found ? c.json(found) : c.json(NOT_FOUND, 404)
      })
      .post('/:code/messages', limitPerUser('client-write', limits.write), async (c) => {
        const code = c.req.param('code')
        if (!TICKET_CODE_PATTERN.test(code)) return c.json(NOT_FOUND, 404)
        const parsed = clientReplySchema.safeParse(await c.req.json().catch(() => null))
        if (!parsed.success) {
          return c.json({ error: 'Confira a mensagem.', fields: fieldErrors(parsed.error) }, 400)
        }
        // `internal` é ignorado: nota interna é só da equipe. `reopen: false` vem do cartão da Wen.
        const { content, reopen } = parsed.data
        const result = await store.reply(c.get('user')!.id, code, content, { reopen })
        if (!result.ok) {
          if (result.reason === 'not_found') return c.json(NOT_FOUND, 404)
          const error = { closed: CLOSED, resolved: RESOLVED, conflict: CONFLICT }[result.reason]
          return c.json(error, 409)
        }
        return c.json({ status: result.status }, 201)
      })
      // "Já resolvi": fecha o chamado com o motivo `client_resolved`.
      .post('/:code/close', limitPerUser('client-write', limits.write), async (c) => {
        const code = c.req.param('code')
        if (!TICKET_CODE_PATTERN.test(code)) return c.json(NOT_FOUND, 404)
        const result = await store.close(c.get('user')!.id, code)
        if (!result.ok)
          return result.reason === 'closed' ? c.json(CLOSED, 409) : c.json(NOT_FOUND, 404)
        return c.json({ status: 'closed' })
      })
      // Cancelar: só enquanto o chamado está aberto e ninguém da equipe respondeu em público.
      .post('/:code/cancel', limitPerUser('client-write', limits.write), async (c) => {
        const code = c.req.param('code')
        if (!TICKET_CODE_PATTERN.test(code)) return c.json(NOT_FOUND, 404)
        const result = await store.cancel(c.get('user')!.id, code)
        if (!result.ok)
          return result.reason === 'not_cancellable'
            ? c.json(NOT_CANCELLABLE, 409)
            : c.json(NOT_FOUND, 404)
        return c.json({ status: 'cancelled' })
      })
  )
}
