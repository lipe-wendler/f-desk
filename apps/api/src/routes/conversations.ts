import type { getConversation, listConversations } from '@f-desk/db'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../middleware/require-role'
import type { AppEnv } from '../middleware/session'

export interface ConversationStore {
  list: typeof listConversations
  get: typeof getConversation
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

const NOT_FOUND = { error: 'Conversa não encontrada.' }

/** Histórico das conversas do cliente com a Wen (gravadas pelo chat quando ele está logado). */
export function createConversationsRoute(store: ConversationStore) {
  return new Hono<AppEnv>()
    .use('*', requireRole('client'))
    .get('/', async (c) => {
      const parsed = listQuerySchema.safeParse(c.req.query())
      if (!parsed.success) return c.json({ error: 'Parâmetros inválidos.' }, 400)
      const { page, pageSize } = parsed.data
      const result = await store.list({
        userId: c.get('user')!.id,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      return c.json(result)
    })
    .get('/:id', async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'))
      if (!id.success) return c.json(NOT_FOUND, 404)
      const found = await store.get(c.get('user')!.id, id.data)
      return found ? c.json(found) : c.json(NOT_FOUND, 404)
    })
}
