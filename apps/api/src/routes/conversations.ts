import type {
  getConversation,
  importConversation,
  listConversations,
  saveConversationFeedback,
} from '@f-desk/db'
import { GUIDED_FEEDBACK, fieldErrors, importConversationSchema } from '@f-desk/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../middleware/require-role'
import type { AppEnv } from '../middleware/session'
import { limitPerUser, type ConsumeQuota } from '../services/rate-limit'

export interface ConversationStore {
  list: typeof listConversations
  get: typeof getConversation
  feedback: typeof saveConversationFeedback
  import: typeof importConversation
}

const feedbackSchema = z.object({ resolved: z.boolean() })

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  /** Busca no texto das mensagens (sidebar do atendimento). */
  q: z.string().trim().max(100).optional(),
})

const NOT_FOUND = { error: 'Conversa não encontrada.' }

/** Histórico das conversas do cliente com a Wen (gravadas pelo chat quando ele está logado). */
export function createConversationsRoute(
  store: ConversationStore,
  limits: { write?: ConsumeQuota } = {},
) {
  return (
    new Hono<AppEnv>()
      .use('*', requireRole('client'))
      .get('/', async (c) => {
        const parsed = listQuerySchema.safeParse(c.req.query())
        if (!parsed.success) return c.json({ error: 'Parâmetros inválidos.' }, 400)
        const { page, pageSize, q } = parsed.data
        const result = await store.list({
          userId: c.get('user')!.id,
          limit: pageSize,
          offset: (page - 1) * pageSize,
          ...(q ? { search: q } : {}),
        })
        return c.json(result)
      })
      // Conversa do visitante que entrou na conta (pelo cartão do chamado, por exemplo): vira uma
      // conversa dele, com o dono da sessão e as mensagens marcadas como importadas.
      .post('/import', limitPerUser('client-write', limits.write), async (c) => {
        const parsed = importConversationSchema.safeParse(await c.req.json().catch(() => null))
        if (!parsed.success) {
          return c.json({ error: 'Conversa inválida.', fields: fieldErrors(parsed.error) }, 400)
        }
        const conversationId = await store.import({
          userId: c.get('user')!.id,
          transcript: parsed.data.transcript,
        })
        return c.json({ conversationId }, 201)
      })
      // "Resolveu" / "Não resolveu" depois de uma resposta pronta: vira mensagem da conversa e muda o status.
      // Os textos são os do atendimento guiado; o cliente só diz se resolveu.
      .post('/:id/feedback', limitPerUser('client-write', limits.write), async (c) => {
        const id = z.uuid().safeParse(c.req.param('id'))
        if (!id.success) return c.json(NOT_FOUND, 404)
        const body = feedbackSchema.safeParse(await c.req.json().catch(() => null))
        if (!body.success) return c.json({ error: 'Resposta inválida.' }, 400)
        const answer = body.data.resolved ? GUIDED_FEEDBACK.resolved : GUIDED_FEEDBACK.unresolved
        const saved = await store.feedback({
          conversationId: id.data,
          userId: c.get('user')!.id,
          resolved: body.data.resolved,
          answer: answer.label,
          reply: answer.reply,
        })
        if (!saved) return c.json(NOT_FOUND, 404)
        return c.json({ status: body.data.resolved ? 'resolved' : 'open' })
      })
      .get('/:id', async (c) => {
        const id = z.uuid().safeParse(c.req.param('id'))
        if (!id.success) return c.json(NOT_FOUND, 404)
        const found = await store.get(c.get('user')!.id, id.data)
        return found ? c.json(found) : c.json(NOT_FOUND, 404)
      })
  )
}
