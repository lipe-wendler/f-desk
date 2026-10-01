import type { Role } from '@f-desk/shared'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { requireAuth, requireRole } from '../middleware/require-role'
import type { AppEnv } from '../middleware/session'

type User = NonNullable<AppEnv['Variables']['user']>

function appWith(user: Partial<User> | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('user', user as User | null)
    c.set('session', null)
    await next()
  })
  app.get('/cliente', requireAuth, (c) => c.text('ok'))
  app.get('/tecnico', requireRole('technician', 'admin'), (c) => c.text('ok'))
  app.get('/admin', requireRole('admin'), (c) => c.text('ok'))
  return app
}

const as = (role: Role, extra: Partial<User> = {}) =>
  appWith({ id: '1', role, banned: false, ...extra })

describe('requireAuth / requireRole', () => {
  it('visitante recebe 401', async () => {
    const app = appWith(null)
    expect((await app.request('/cliente')).status).toBe(401)
    expect((await app.request('/tecnico')).status).toBe(401)
  })

  it('cliente não acessa área do técnico nem do admin', async () => {
    const app = as('client')
    expect((await app.request('/cliente')).status).toBe(200)
    expect((await app.request('/tecnico')).status).toBe(403)
    expect((await app.request('/admin')).status).toBe(403)
  })

  it('técnico acessa o dashboard mas não a gestão de usuários', async () => {
    const app = as('technician')
    expect((await app.request('/tecnico')).status).toBe(200)
    expect((await app.request('/admin')).status).toBe(403)
  })

  it('admin acessa tudo', async () => {
    const app = as('admin')
    expect((await app.request('/tecnico')).status).toBe(200)
    expect((await app.request('/admin')).status).toBe(200)
  })

  it('usuário banido é bloqueado', async () => {
    expect((await as('admin', { banned: true }).request('/admin')).status).toBe(403)
  })
})
