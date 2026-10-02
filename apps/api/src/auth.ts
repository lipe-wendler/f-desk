import { db, schema } from '@f-desk/db'
import { DEFAULT_ROLE, PASSWORD_MAX, PASSWORD_MIN } from '@f-desk/shared'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { adminGuard } from './auth/admin-guard'
import { ac, roles } from './auth/permissions'
import { env, trustedOrigins } from './env'

/**
 * better-auth do F.Desk.
 * - Sign-up público por e-mail/senha cria sempre `client` (`defaultRole`; `role` não é aceito no corpo).
 * - Técnicos e outros admins são criados por um admin via `admin.createUser`.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN,
    maxPasswordLength: PASSWORD_MAX,
  },
  // Ativo só em produção (padrão do better-auth). Em serverless cada instância tem memória
  // própria, então o contador fica no Postgres.
  rateLimit: {
    storage: 'database',
  },
  advanced: {
    // Na Vercel, `x-real-ip` é definido pela borda com o IP real do visitante.
    ipAddress: { ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'] },
  },
  hooks: {
    before: adminGuard,
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: DEFAULT_ROLE,
      adminRoles: ['admin'],
    }),
  ],
})

export type AuthSession = typeof auth.$Infer.Session
