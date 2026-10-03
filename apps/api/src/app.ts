import { Hono } from 'hono'
import {
  addClientReply,
  addStaffReply,
  cancelClientTicket,
  closeClientTicket,
  consumeChatQuota,
  createTicket,
  getClientTicket,
  getConversation,
  getConversationHistory,
  getStaffMetrics,
  getStaffTicket,
  importConversation,
  listAssignees,
  listClientTickets,
  listConversations,
  listStaffTickets,
  saveChatExchange,
  saveConversationFeedback,
  updateStaffTicket,
} from '@f-desk/db'
import { auth } from './auth'
import { env, trustedOrigins } from './env'
import {
  apiBodyLimit,
  apiCsrf,
  apiSecureHeaders,
  onApiError,
  requestLogger,
} from './middleware/security'
import { sessionMiddleware, type AppEnv } from './middleware/session'
import { adminUsers } from './routes/admin-users'
import { createChatRoute } from './routes/chat'
import { createConversationsRoute } from './routes/conversations'
import { health } from './routes/health'
import { createStaffRoute } from './routes/staff'
import { createTicketsRoute } from './routes/tickets'
import { createLanguageModel, resolveLlmConfig } from './services/llm/models'
import { CHAT_HISTORY_MAX } from '@f-desk/shared'
import { createQuota } from './services/rate-limit'

/**
 * App Hono do F.Desk, servido em `/api`.
 * Na Vercel roda como Function (`api/index.js`); em dev, via `src/dev.ts`.
 */
export const app = new Hono<AppEnv>().basePath('/api')

app.use(requestLogger, apiSecureHeaders, apiBodyLimit)
app.onError(onApiError)

// better-auth responde por conta própria em /api/auth/* (sign-up, sign-in, admin…).
app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

app.route('/health', health)

// Escrita só a partir do próprio site (o better-auth acima confere a origem por conta própria).
app.use('*', apiCsrf(trustedOrigins))
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
    loadHistory: (userId, id) => getConversationHistory(userId, id, CHAT_HISTORY_MAX),
  }),
)

app.route(
  '/tickets',
  createTicketsRoute(
    {
      create: createTicket,
      list: listClientTickets,
      get: getClientTicket,
      reply: addClientReply,
      close: closeClientTicket,
      cancel: cancelClientTicket,
    },
    {
      create: createQuota(env.TICKET_CREATE_LIMIT, 3600, consumeChatQuota),
      write: createQuota(env.TICKET_WRITE_LIMIT, 600, consumeChatQuota),
    },
  ),
)
app.route(
  '/conversations',
  createConversationsRoute(
    {
      list: listConversations,
      get: getConversation,
      feedback: saveConversationFeedback,
      import: importConversation,
    },
    {
      write: createQuota(env.TICKET_WRITE_LIMIT, 600, consumeChatQuota),
      // Mesmo volume que abrir chamado (transcrição de até 100 mensagens): a mesma cota por hora.
      import: createQuota(env.TICKET_CREATE_LIMIT, 3600, consumeChatQuota),
    },
  ),
)

app.route(
  '/staff',
  createStaffRoute(
    {
      list: listStaffTickets,
      metrics: getStaffMetrics,
      get: getStaffTicket,
      reply: addStaffReply,
      update: updateStaffTicket,
      assignees: listAssignees,
    },
    { write: createQuota(env.STAFF_WRITE_LIMIT, 600, consumeChatQuota) },
  ),
)

app.notFound((c) => c.json({ error: 'Rota não encontrada.' }, 404))

export type AppType = typeof app
export default app
