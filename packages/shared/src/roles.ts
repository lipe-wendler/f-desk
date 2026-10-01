/**
 * Perfis da plataforma.
 * - `client`: cria a própria conta no sign-up; abre chamados e vê o próprio histórico.
 * - `technician`: conta criada pelo admin; gerencia chamados no dashboard.
 * - `admin`: tudo do técnico + gestão de usuários.
 */
export const ROLES = ['client', 'technician', 'admin'] as const
export type Role = (typeof ROLES)[number]

/** Role atribuída a toda conta criada pelo sign-up público. */
export const DEFAULT_ROLE: Role = 'client'

/** Roles com acesso ao dashboard de chamados. */
export const STAFF_ROLES = ['technician', 'admin'] as const satisfies readonly Role[]

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function hasRole(role: unknown, allowed: readonly Role[]): boolean {
  return isRole(role) && allowed.includes(role)
}
