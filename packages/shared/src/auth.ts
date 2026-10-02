import { z } from 'zod'
import type { Role } from './roles'

/** Limites de senha usados pela API (better-auth) e pelos formulários. */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export const ROLE_LABEL: Record<Role, string> = {
  client: 'Cliente',
  technician: 'Técnico',
  admin: 'Admin',
}

// Normaliza antes de validar: espaços e maiúsculas não podem gerar contas duplicadas.
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Informe um e-mail válido.' }))

export const nameField = z
  .string()
  .trim()
  .min(2, { error: 'Informe o nome.' })
  .max(80, { error: 'Use no máximo 80 caracteres.' })

export const passwordField = z
  .string()
  .min(PASSWORD_MIN, { error: `A senha precisa ter ${PASSWORD_MIN} caracteres ou mais.` })
  .max(PASSWORD_MAX, { error: `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.` })

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, { error: 'Informe sua senha.' }),
})
export type SignInInput = z.infer<typeof signInSchema>

export const signUpSchema = z
  .object({
    name: nameField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'As senhas não conferem.',
    path: ['confirmPassword'],
  })
export type SignUpInput = z.infer<typeof signUpSchema>

/** Primeiro erro de cada campo de um `safeParse` que falhou, para exibir no formulário. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}
