import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { auth } from './auth'
import { sessionMiddleware, type AppEnv } from './middleware/session'
import { adminUsers } from './routes/admin-users'
import { health } from './routes/health'

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

// Próximas tarefas:
// app.route('/chat', chat)                                          → público, com rate limit
// app.route('/tickets', tickets)                                     → requireAuth
// app.route('/staff/tickets', staffTickets)  + requireRole('technician', 'admin')

app.notFound((c) => c.json({ error: 'Rota não encontrada.' }, 404))

export type AppType = typeof app
export default app
