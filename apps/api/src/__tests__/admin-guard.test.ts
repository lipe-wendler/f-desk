import { checkAdminChange, type AdminChange } from '@f-desk/shared'
import { describe, expect, it } from 'vitest'
import { app } from '../app'

const admin = { id: 'a1', role: 'admin', banned: false }
const tech = { id: 't1', role: 'technician', banned: false }

const change = (overrides: Partial<AdminChange>): AdminChange => ({
  action: 'set-role',
  actorId: 'a1',
  target: tech,
  role: 'admin',
  activeAdmins: 1,
  ...overrides,
})

describe('checkAdminChange', () => {
  it('permite promover e rebaixar outros usuários', () => {
    expect(checkAdminChange(change({ role: 'admin' }))).toBeNull()
    expect(checkAdminChange(change({ role: 'client' }))).toBeNull()
    expect(
      checkAdminChange(
        change({ target: { id: 'a2', role: 'admin' }, role: 'technician', activeAdmins: 2 }),
      ),
    ).toBeNull()
  })

  it('recusa perfil inválido', () => {
    expect(checkAdminChange(change({ role: 'superuser' }))).toBe('INVALID_ROLE')
    expect(checkAdminChange(change({ role: undefined }))).toBe('INVALID_ROLE')
  })

  it('não deixa alterar o próprio perfil', () => {
    expect(checkAdminChange(change({ target: admin, role: 'technician', activeAdmins: 3 }))).toBe(
      'CANNOT_CHANGE_OWN_ROLE',
    )
  })

  it('não deixa rebaixar o último admin ativo', () => {
    expect(
      checkAdminChange(change({ actorId: 'x', target: admin, role: 'client', activeAdmins: 1 })),
    ).toBe('LAST_ADMIN')
  })

  it('não deixa desativar a si mesmo nem o último admin', () => {
    expect(checkAdminChange(change({ action: 'ban', target: admin, activeAdmins: 2 }))).toBe(
      'CANNOT_BAN_YOURSELF',
    )
    expect(
      checkAdminChange(change({ action: 'ban', actorId: 'x', target: admin, activeAdmins: 1 })),
    ).toBe('LAST_ADMIN')
    expect(checkAdminChange(change({ action: 'ban', target: tech }))).toBeNull()
  })

  it('admin já desativado não conta como último admin', () => {
    expect(
      checkAdminChange(
        change({
          actorId: 'x',
          target: { ...admin, banned: true },
          role: 'client',
          activeAdmins: 1,
        }),
      ),
    ).toBeNull()
  })
})

describe('rotas de gestão de usuários', () => {
  const post = (path: string, body: unknown) =>
    app.request(`/api/auth/admin/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify(body),
    })

  it('exigem sessão', async () => {
    expect((await post('set-role', { userId: 'x', role: 'admin' })).status).toBe(401)
    expect((await post('ban-user', { userId: 'x' })).status).toBe(401)
  })

  it('recusam perfil inválido ao criar conta antes de qualquer outra coisa', async () => {
    const res = await post('create-user', {
      email: 'x@f-desk.invalid',
      password: '12345678',
      name: 'X',
      role: 'root',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'INVALID_ROLE' })
  })
})

describe('GET /api/admin/users', () => {
  it('exige sessão de admin', async () => {
    expect((await app.request('/api/admin/users')).status).toBe(401)
  })
})
