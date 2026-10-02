import { z } from 'zod'
import { emailField, nameField, passwordField } from './auth'
import { ROLES, isRole, type Role } from './roles'

/** Perfis que o admin pode atribuir ao criar uma conta pela gestão de usuários. */
export const STAFF_CREATABLE_ROLES = ['technician', 'admin'] as const satisfies readonly Role[]

/** Conta criada pelo admin na gestão de usuários (técnico ou outro admin). */
export const createStaffUserSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  role: z.enum(STAFF_CREATABLE_ROLES, { error: 'Escolha o perfil.' }),
})
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>

export const setPasswordSchema = z.object({ password: passwordField })

export const ROLE_DESCRIPTION: Record<Role, string> = {
  client: 'Abre chamados e acompanha o próprio histórico.',
  technician: 'Atende e gerencia chamados no dashboard.',
  admin: 'Tudo do técnico, mais a gestão de usuários.',
}

export const ASSIGNABLE_ROLES = ROLES

/** Códigos de erro das regras extras da gestão de usuários (aplicadas pela API). */
export const ADMIN_GUARD_ERRORS = {
  INVALID_ROLE: 'Perfil inválido.',
  CANNOT_CHANGE_OWN_ROLE: 'Você não pode alterar o seu próprio perfil.',
  CANNOT_BAN_YOURSELF: 'Você não pode desativar a sua própria conta.',
  LAST_ADMIN: 'A plataforma precisa de pelo menos um admin ativo.',
} as const
export type AdminGuardError = keyof typeof ADMIN_GUARD_ERRORS

export interface AdminChange {
  action: 'set-role' | 'ban'
  actorId: string
  target: { id: string; role: string | null | undefined; banned?: boolean | null }
  /** Novo perfil (só em `set-role`). */
  role?: unknown
  /** Quantos admins ativos (não desativados) existem hoje, incluindo o alvo. */
  activeAdmins: number
}

/**
 * Regras que o plugin admin do better-auth não cobre sozinho:
 * - ninguém altera o próprio perfil nem se desativa;
 * - a plataforma nunca fica sem admin ativo.
 * Devolve o código do erro ou `null` quando a mudança é permitida.
 */
export function checkAdminChange(change: AdminChange): AdminGuardError | null {
  const isSelf = change.actorId === change.target.id
  const targetIsActiveAdmin = change.target.role === 'admin' && !change.target.banned

  if (change.action === 'set-role') {
    if (!isRole(change.role)) return 'INVALID_ROLE'
    if (isSelf) return 'CANNOT_CHANGE_OWN_ROLE'
    if (targetIsActiveAdmin && change.role !== 'admin' && change.activeAdmins <= 1)
      return 'LAST_ADMIN'
    return null
  }

  if (isSelf) return 'CANNOT_BAN_YOURSELF'
  if (targetIsActiveAdmin && change.activeAdmins <= 1) return 'LAST_ADMIN'
  return null
}
