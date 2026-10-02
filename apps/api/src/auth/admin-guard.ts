import { countActiveAdmins, findUserAccess } from '@f-desk/db'
import { ADMIN_GUARD_ERRORS, checkAdminChange, isRole, type AdminGuardError } from '@f-desk/shared'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'

type Body = { userId?: string; role?: unknown }

function reject(code: AdminGuardError): never {
  throw new APIError('BAD_REQUEST', { code, message: ADMIN_GUARD_ERRORS[code] })
}

/**
 * Hook `before` do better-auth para as rotas de gestão de usuários: aplica as regras de
 * `checkAdminChange` (não alterar o próprio perfil, não ficar sem admin ativo) e só aceita
 * perfis válidos na criação de contas. As permissões em si continuam com o plugin admin.
 */
export const adminGuard = createAuthMiddleware(async (ctx) => {
  if (ctx.path === '/admin/create-user') {
    const role = (ctx.body as Body | undefined)?.role
    if (role !== undefined && !isRole(role)) reject('INVALID_ROLE')
    return
  }
  if (ctx.path !== '/admin/set-role' && ctx.path !== '/admin/ban-user') return

  const session = await getSessionFromCtx(ctx)
  const body = (ctx.body ?? {}) as Body
  // Sem sessão ou sem alvo, o próprio endpoint responde 401/400.
  if (!session || !body.userId) return

  const target = await findUserAccess(body.userId)
  if (!target) return

  const error = checkAdminChange({
    action: ctx.path === '/admin/set-role' ? 'set-role' : 'ban',
    actorId: session.user.id,
    target,
    role: body.role,
    activeAdmins: target.role === 'admin' ? await countActiveAdmins() : 0,
  })
  if (error) reject(error)
})
