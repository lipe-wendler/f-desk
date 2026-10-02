import { Hono } from 'hono'
import { logger } from 'hono/logger'
import {
  addClientReply,
  closeClientTicket,
  consumeChatQuota,
  createTicket,
  getClientTicket,
  getConversation,
  listClientTickets,
  listConversations,
  saveChatExchange,
} from '@f-desk/db'
import { auth } from './auth'
import { env } from './env'
import { sessionMiddleware, type AppEnv } from './middleware/session'
import { adminUsers } from './routes/admin-users'
import { createChatRoute } from './routes/chat'
import { createConversationsRoute } from './routes/conversations'
import { health } from './routes/health'
import { createTicketsRoute } from './routes/tickets'
import { createLanguageModel, resolveLlmConfig } from './services/llm/models'
import { createQuota } from './services/rate-limit'

/**
 * App Hono do F.Desk, servido em `/api`.
 * Na Vercel roda como Function (`api/[[...route]].ts`); em dev, via `src/dev.ts`.
 */
export const app = new Hono<AppEnv>().basePath('/api')

app.use(logger())

// better-auth responde por conta própria em /api/auth/* (sign-up, sign-in, admin…).
app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

app.route('/health', health)

// Demais rotas enxergam o usuário logado (ou null para visitantes).
app.use('*', sessionMiddleware)

app.route('/admin/users', adminUsers)

const llm = resolveLlmConfig(env.LLM_MODEL, env)
if (!llm)
  console.warn(`[chat] LLM desligado: confira LLM_MODEL (${env.LLM_MODEL}) e a chave do provedor.`)

app.route(
  '/chat',
  createChatRoute({
    model: llm ? createLanguageModel(llm) : null,
    consumeQuota: createQuota(env.CHAT_RATE_LIMIT, env.CHAT_RATE_WINDOW_SECONDS, consumeChatQuota),
    saveExchange: saveChatExchange,
    secret: env.BETTER_AUTH_SECRET,
  }),
)

app.route(
  '/tickets',
  createTicketsRoute({
    create: createTicket,
    list: listClientTickets,
    get: getClientTicket,
    reply: addClientReply,
    close: closeClientTicket,
  }),
)
app.route(
  '/conversations',
  createConversationsRoute({ list: listConversations, get: getConversation }),
)

// Próxima tarefa:
// app.route('/staff/tickets', staffTickets)  + requireRole('technician', 'admin')

app.notFound((c) => c.json({ error: 'Rota não encontrada.' }, 404))

export type AppType = typeof app
export default app
