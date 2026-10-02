import { createHmac } from 'node:crypto'

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
