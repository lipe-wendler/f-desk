import type { Role } from '@f-desk/shared'
import { authClient } from '../../lib/auth-client'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  banned: boolean
  banReason?: string | null
  createdAt: string
}

export interface UserListQuery {
  search?: string
  role?: Role | 'all'
  page: number
  pageSize: number
}

type Result<T> =
  | { data: T; error: null }
  | { data: null; error: { code?: string; message?: string; status?: number } }

function unwrap<T>(res: { data: unknown; error: unknown }): Result<T> {
  return res.error
    ? { data: null, error: res.error as { code?: string; message?: string; status?: number } }
    : { data: res.data as T, error: null }
}

/**
 * Gestão de usuários: a lista vem de `GET /api/admin/users` (busca sem diferenciar maiúsculas
 * em nome e e-mail); as alterações usam o plugin admin do better-auth. Permissões na API.
 */
export const usersApi = {
  async list(q: UserListQuery): Promise<Result<{ users: AdminUser[]; total: number }>> {
    const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) })
    const term = q.search?.trim()
    if (term) params.set('search', term)
    if (q.role && q.role !== 'all') params.set('role', q.role)
    try {
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' })
      if (!res.ok) return { data: null, error: { status: res.status } }
      return { data: (await res.json()) as { users: AdminUser[]; total: number }, error: null }
    } catch {
      return { data: null, error: {} }
    }
  },

  async create(input: { name: string; email: string; password: string; role: Role }) {
    return unwrap(
      await authClient.admin.createUser(input as Parameters<typeof authClient.admin.createUser>[0]),
    )
  },

  async setRole(userId: string, role: Role) {
    return unwrap(
      await authClient.admin.setRole({ userId, role } as Parameters<
        typeof authClient.admin.setRole
      >[0]),
    )
  },

  async setPassword(userId: string, newPassword: string) {
    return unwrap(await authClient.admin.setUserPassword({ userId, newPassword }))
  },

  async ban(userId: string, banReason?: string) {
    return unwrap(await authClient.admin.banUser({ userId, banReason: banReason || undefined }))
  },

  async unban(userId: string) {
    return unwrap(await authClient.admin.unbanUser({ userId }))
  },

  async revokeSessions(userId: string) {
    return unwrap(await authClient.admin.revokeUserSessions({ userId }))
  },
}
