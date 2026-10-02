import { hasRole, type Role } from '@f-desk/shared'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from './session'

/** Exige usuário logado (401 caso contrário). */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'Faça login para continuar.' }, 401)
  await next()
})

/** Conta desativada; a desativação com prazo (`banExpires`) deixa de valer quando o prazo passa. */
export function isBanned(user: { banned?: boolean | null; banExpires?: Date | null }) {
  if (!user.banned) return false
  return !user.banExpires || new Date(user.banExpires).getTime() > Date.now()
}

/** Exige login e um dos perfis informados (403 para os demais). */
export function requireRole(...allowed: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Faça login para continuar.' }, 401)
    if (isBanned(user) || !hasRole(user.role, allowed)) {
      return c.json({ error: 'Você não tem acesso a este recurso.' }, 403)
    }
    await next()
  })
}
