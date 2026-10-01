// Entrada da Vercel Function: toda requisição /api/* chega aqui (rewrite em vercel.json)
// e é atendida pelo app Hono de apps/api, empacotado em apps/api/dist/app.js no build.
import app from '../apps/api/dist/app.js'

const handler = (request) => app.fetch(request)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
