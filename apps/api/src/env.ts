import { z } from 'zod'

const isProduction =
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'

// Na Vercel, previews ganham uma URL por deploy; ela vira a baseURL do better-auth quando
// BETTER_AUTH_URL não está definida (em produção, defina BETTER_AUTH_URL com o domínio final).
const vercelUrls = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`)

// Em dev/teste há valores padrão para a API subir sem `.env` (ex.: /api/health).
// Em produção, tudo que é sensível é obrigatório.
const schema = z.object({
  DATABASE_URL: isProduction
    ? z.url()
    : z.url().default('postgresql://f_desk:f_desk@localhost:5432/f_desk'),
  BETTER_AUTH_SECRET: isProduction
    ? z.string().min(32)
    : z.string().min(32).default('dev-secret-nao-use-em-producao-0123456789'),
  BETTER_AUTH_URL: z.url().default(vercelUrls[0] ?? 'http://localhost:5173'),
  /** Origens extras aceitas pelo better-auth (separadas por vírgula), ex.: previews da Vercel. */
  TRUSTED_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ANTHROPIC_API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(3000),
})

export const env = schema.parse(process.env)

/** Origens aceitas pelo better-auth: a baseURL, as URLs do deploy atual na Vercel e as extras. */
export const trustedOrigins = [
  ...new Set([env.BETTER_AUTH_URL, ...vercelUrls, ...env.TRUSTED_ORIGINS]),
]
export type Env = typeof env
