import type { Context, ErrorHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { csrf } from 'hono/csrf'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'

/** Cabeçalhos de segurança das respostas da API (o SPA recebe os seus pelo `vercel.json`). */
export const apiSecureHeaders = secureHeaders({
  // A API só devolve JSON e NDJSON: nada dela deve carregar recurso nem ir para um iframe.
  contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  xFrameOptions: 'DENY',
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginResourcePolicy: 'same-origin',
})

/**
 * Bloqueia escrita vinda de outro site (formulário ou `text/plain` com o cookie da sessão).
 * Aceita a própria origem e as `trustedOrigins` do better-auth (o Vite em dev, previews da Vercel).
 * JSON de outra origem já esbarra no CORS, que a API não libera.
 */
export function apiCsrf(trustedOrigins: readonly string[]) {
  return csrf({
    origin: (origin, c) => origin === new URL(c.req.url).origin || trustedOrigins.includes(origin),
  })
}

/** Corpo maior que isso é recusado antes de ser lido (os limites dos campos vêm depois, no zod). */
export const BODY_LIMIT = 512 * 1024
/** Abrir chamado leva a transcrição do navegador junto (até 100 mensagens de 4000 caracteres). */
export const TICKET_BODY_LIMIT = 2 * 1024 * 1024

const tooLarge = (c: Context) => c.json({ error: 'Conteúdo grande demais.' }, 413)

export const apiBodyLimit = createMiddleware(async (c, next) => {
  const isTicketCreation = c.req.method === 'POST' && c.req.path === '/api/tickets'
  return bodyLimit({
    maxSize: isTicketCreation ? TICKET_BODY_LIMIT : BODY_LIMIT,
    onError: tooLarge,
  })(c, next)
})

/**
 * Log de cada requisição sem a query string: buscas da equipe e do admin podem levar nome e e-mail.
 */
export const requestLogger = createMiddleware(async (c, next) => {
  const start = Date.now()
  await next()
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - start}ms`)
})

/** Erro inesperado vira um 500 genérico; o detalhe fica só no log do servidor. */
export const onApiError: ErrorHandler = (error, c) => {
  if (error instanceof HTTPException) return error.getResponse()
  console.error(`[api] erro em ${c.req.method} ${c.req.path}`, error)
  return c.json({ error: 'Algo deu errado do nosso lado. Tente de novo em instantes.' }, 500)
}
