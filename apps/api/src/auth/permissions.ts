import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/admin/access'

/**
 * Permissões por perfil. `user` e `session` são os recursos do plugin admin do
 * better-auth; `ticket` é do F.Desk e é conferido pela nossa API.
 */
export const statements = {
  ...defaultStatements,
  ticket: ['create', 'read-own', 'read', 'update', 'assign'],
} as const

export const ac = createAccessControl(statements)

export const client = ac.newRole({
  ticket: ['create', 'read-own'],
})

export const technician = ac.newRole({
  ticket: ['read', 'update', 'assign'],
})

// Só o que a gestão de usuários usa: sem personificar (`impersonate`) nem apagar contas
// (`delete`) — contas são desativadas para manter o histórico de chamados.
export const admin = ac.newRole({
  user: ['create', 'list', 'get', 'update', 'set-role', 'ban', 'set-password'],
  session: ['list', 'revoke'],
  ticket: ['read', 'update', 'assign'],
})

export const roles = { client, technician, admin }
