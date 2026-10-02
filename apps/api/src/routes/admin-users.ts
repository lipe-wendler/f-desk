import { listUsers } from '@f-desk/db'
import { ROLES } from '@f-desk/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../middleware/require-role'
import type { AppEnv } from '../middleware/session'

const querySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.enum(ROLES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/**
 * Leitura da gestão de usuários (só admin). As alterações (criar, perfil, senha, acesso)
 * usam os endpoints do plugin admin do better-auth em /api/auth/admin/*.
 */
export const adminUsers = new Hono<AppEnv>().use('*', requireRole('admin')).get('/', async (c) => {
  const parsed = querySchema.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'Parâmetros inválidos.' }, 400)
  const { search, role, page, pageSize } = parsed.data
  const result = await listUsers({ search, role, limit: pageSize, offset: (page - 1) * pageSize })
  return c.json(result)
})
