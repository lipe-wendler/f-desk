import { z } from 'zod'
import { DEFAULT_LLM_MODEL } from './services/llm/models'

// Na Vercel (produção e previews) ou com NODE_ENV=production, nada sensível tem valor padrão:
// um preview sem BETTER_AUTH_SECRET não pode assinar sessões com o segredo público de dev.
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)

// Na Vercel, previews ganham uma URL por deploy; ela vira a baseURL do better-auth quando
// BETTER_AUTH_URL não está definida (em produção, defina BETTER_AUTH_URL com o domínio final).
const vercelUrls = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`)

// Na máquina local (dev/teste) há valores padrão para a API subir sem `.env` (ex.: /api/health).
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
  /** Modelo do chat fora do FAQ, no formato `<provedor>:<modelo>` (provedores em services/llm/models.ts). */
  LLM_MODEL: z.string().trim().default(DEFAULT_LLM_MODEL),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  /** Mensagens por janela no chat, por IP (visitante) ou por conta (logado). */
  CHAT_RATE_LIMIT: z.coerce.number().int().min(1).default(20),
  CHAT_RATE_WINDOW_SECONDS: z.coerce.number().int().min(1).default(600),
  /** Chamados abertos por hora, por cliente. */
  TICKET_CREATE_LIMIT: z.coerce.number().int().min(1).default(5),
  /** Respostas e encerramentos do cliente a cada 10 minutos. */
  TICKET_WRITE_LIMIT: z.coerce.number().int().min(1).default(30),
  /** Respostas e alterações de chamado da equipe a cada 10 minutos, por pessoa. */
  STAFF_WRITE_LIMIT: z.coerce.number().int().min(1).default(120),
  PORT: z.coerce.number().default(3000),
})

export const env = schema.parse(process.env)

/** Origens aceitas pelo better-auth: a baseURL, as URLs do deploy atual na Vercel e as extras. */
export const trustedOrigins = [
  ...new Set([env.BETTER_AUTH_URL, ...vercelUrls, ...env.TRUSTED_ORIGINS]),
]
export type Env = typeof env
