import { describe, expect, it } from 'vitest'
import { app } from '../app'

describe('app', () => {
  it('responde /api/health', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('monta o better-auth em /api/auth', async () => {
    const res = await app.request('/api/auth/ok')
    expect(res.status).toBe(200)
  })

  it('responde 404 em JSON para rotas desconhecidas', async () => {
    const res = await app.request('/api/nao-existe')
    expect(res.status).toBe(404)
  })

  it('não aceita role no sign-up público', async () => {
    // O plugin admin marca `role` como input: false; o better-auth recusa o campo antes de tocar no banco.
    const res = await app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({
        email: 'x@exemplo.com',
        password: '12345678',
        name: 'X',
        role: 'admin',
      }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'FIELD_NOT_ALLOWED' })
  })
})
