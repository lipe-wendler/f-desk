import { describe, expect, it } from 'vitest'
import { clientIp, createQuota, quotaKey } from '../services/rate-limit'

describe('limite do chat', () => {
  it('libera até o limite e depois informa quando tentar de novo', async () => {
    let count = 0
    const resetAt = new Date(Date.now() + 90_000)
    const quota = createQuota(2, 600, async () => ({ count: ++count, resetAt }))
    expect((await quota('k')).allowed).toBe(true)
    expect((await quota('k')).allowed).toBe(true)
    const third = await quota('k')
    expect(third.allowed).toBe(false)
    expect(third.retryAfter).toBeGreaterThan(80)
    expect(third.retryAfter).toBeLessThanOrEqual(90)
  })

  it('conta por conta quando há login e pelo hash do IP no visitante', () => {
    expect(quotaKey('s', 'u1', '1.2.3.4')).toBe('user:u1')
    const key = quotaKey('s', undefined, '1.2.3.4')
    expect(key).toMatch(/^ip:[0-9a-f]{32}$/)
    expect(key).not.toContain('1.2.3.4')
    expect(quotaKey('s', undefined, '1.2.3.4')).toBe(key)
    expect(quotaKey('outro', undefined, '1.2.3.4')).not.toBe(key)
  })

  it('lê o IP de x-real-ip ou do primeiro x-forwarded-for', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1' }))).toBe(
      '9.9.9.9',
    )
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1')
    expect(clientIp(new Headers())).toBe('desconhecido')
  })
})
