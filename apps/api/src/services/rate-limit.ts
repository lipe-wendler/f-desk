import { createHmac } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../middleware/session'

export interface QuotaResult {
  allowed: boolean
  /** Segundos até a janela reabrir (só faz sentido quando `allowed` é falso). */
  retryAfter: number
}

export type ConsumeQuota = (key: string) => Promise<QuotaResult>

/** Limite de `limit` mensagens por `windowSeconds`, contado por `consume` (no Postgres em produção). */
export function createQuota(
  limit: number,
  windowSeconds: number,
  consume: (key: string, windowSeconds: number) => Promise<{ count: number; resetAt: Date }>,
): ConsumeQuota {
  return async (key) => {
    const { count, resetAt } = await consume(key, windowSeconds)
    const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
    return { allowed: count <= limit, retryAfter }
  }
}

/** IP do visitante. Na Vercel, `x-real-ip` vem da borda; `x-forwarded-for` cobre o proxy do Vite em dev. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-real-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'desconhecido'
  )
}

/** Chave do limite: o usuário logado, ou o IP do visitante como hash (o IP em si não é guardado). */
export function quotaKey(secret: string, userId: string | undefined, ip: string): string {
  if (userId) return `user:${userId}`
  return `ip:${createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32)}`
}

/**
 * Middleware de limite por usuário logado (rotas que já exigem login). `bucket` separa os contadores
 * na mesma tabela: `ticket:user:<id>` não divide a cota com o chat (`user:<id>`).
 */
export function limitPerUser(bucket: string, consume: ConsumeQuota | undefined) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (consume && user) {
      const quota = await consume(`${bucket}:user:${user.id}`)
      if (!quota.allowed) {
        c.header('Retry-After', String(quota.retryAfter))
        return c.json(
          { error: 'Muitas tentativas em pouco tempo. Espere um pouco e tente de novo.' },
          429,
        )
      }
    }
    await next()
  })
}
