import { ADMIN_GUARD_ERRORS, type AdminGuardError } from '@f-desk/shared'

/** Erro devolvido pelo cliente do better-auth (`{ data, error }`). */
export interface AuthClientError {
  code?: string
  message?: string
  status?: number
}

/** Traduz os erros do better-auth (e das regras da gestão de usuários) para mensagens do F.Desk. */
export function authErrorMessage(error: AuthClientError | null | undefined): string {
  if (error?.status === 429) return 'Muitas tentativas. Aguarde um minuto e tente de novo.'
  const code = error?.code
  if (code && code in ADMIN_GUARD_ERRORS) return ADMIN_GUARD_ERRORS[code as AdminGuardError]
  if (error?.status === 403) return 'Você não tem permissão para fazer isso.'
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'E-mail ou senha incorretos.'
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'Já existe uma conta com esse e-mail.'
    case 'PASSWORD_TOO_SHORT':
      return 'A senha é curta demais.'
    case 'PASSWORD_TOO_LONG':
      return 'A senha é longa demais.'
    case 'INVALID_EMAIL':
      return 'Informe um e-mail válido.'
    case 'YOU_CANNOT_BAN_YOURSELF':
      return ADMIN_GUARD_ERRORS.CANNOT_BAN_YOURSELF
    case 'USER_NOT_FOUND':
      return 'Usuário não encontrado. Atualize a lista.'
    case 'BANNED_USER':
      return 'Sua conta está desativada. Fale com o suporte da F.Wendler.'
    default:
      return 'Não foi possível concluir agora. Tente de novo em instantes.'
  }
}

export function isExistingAccountError(error: AuthClientError | null | undefined): boolean {
  return (
    error?.code === 'USER_ALREADY_EXISTS' || error?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
  )
}
