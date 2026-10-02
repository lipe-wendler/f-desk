import { and, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm'
import { db } from '../client'
import { user } from '../schema'

/** Perfil e status de um usuário, usados pelas regras da gestão de usuários. */
export async function findUserAccess(id: string) {
  const [row] = await db
    .select({ id: user.id, role: user.role, banned: user.banned })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)
  return row ?? null
}

/** Quantos admins ativos (não desativados) a plataforma tem. */
export async function countActiveAdmins() {
  const [row] = await db
    .select({ n: count() })
    .from(user)
    .where(and(eq(user.role, 'admin'), or(eq(user.banned, false), isNull(user.banned))))
  return row?.n ?? 0
}

export interface ListUsersParams {
  search?: string
  role?: string
  limit: number
  offset: number
}

/** Lista para a gestão de usuários: busca sem diferenciar maiúsculas em nome e e-mail. */
export async function listUsers({ search, role, limit, offset }: ListUsersParams) {
  const filters: SQL[] = []
  const term = search?.trim()
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    filters.push(or(ilike(user.name, pattern), ilike(user.email, pattern))!)
  }
  if (role) filters.push(eq(user.role, role))
  const where = filters.length ? and(...filters) : undefined

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ n: count() }).from(user).where(where),
  ])
  return { users: rows, total: totalRow?.n ?? 0 }
}
