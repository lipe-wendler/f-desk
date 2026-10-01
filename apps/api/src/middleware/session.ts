import { createMiddleware } from 'hono/factory'
import { auth, type AuthSession } from '../auth'

export type AppEnv = {
  Variables: {
    user: AuthSession['user'] | null
    session: AuthSession['session'] | null
  }
}

/** Anexa usuário e sessão ao contexto quando existem. Rotas públicas seguem funcionando sem login. */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  c.set('user', result?.user ?? null)
  c.set('session', result?.session ?? null)
  await next()
})
