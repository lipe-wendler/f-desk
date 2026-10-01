import { hasRole, STAFF_ROLES, type Role } from '@f-desk/shared'
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

/** Página inicial de cada perfil. */
export function homeFor(role: Role | undefined): RouteLocationRaw {
  return role && hasRole(role, STAFF_ROLES) ? { name: 'staff-dashboard' } : { name: 'chat' }
}

/**
 * Decide se a navegação segue (`true`) ou para onde redirecionar.
 * - Rota com `roles` e visitante → tela de login, voltando para a rota pedida depois.
 * - Rota com `roles` e perfil sem acesso → página de acesso negado.
 * - Rota `guestOnly` (entrar/criar conta) com usuário logado → página inicial do perfil.
 * A API repete essas regras: o front nunca é a única barreira.
 */
export function resolveAccess(
  to: Pick<RouteLocationNormalized, 'meta' | 'fullPath'>,
  role: Role | undefined,
): true | RouteLocationRaw {
  if (to.meta.guestOnly && role) return homeFor(role)
  const allowed = to.meta.roles
  if (!allowed) return true
  if (!role) return { name: 'sign-in', query: { redirect: to.fullPath } }
  return hasRole(role, allowed) ? true : { name: 'forbidden' }
}
