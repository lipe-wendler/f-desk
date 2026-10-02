import type { ChatExchange } from '@f-desk/db'
import {
  CHAT_ERROR_REPLY,
  CHAT_FALLBACK_REPLY,
  chatRequestSchema,
  fieldErrors,
  type ChatEvent,
  type ChatReplySource,
} from '@f-desk/shared'
import type { LanguageModel } from 'ai'
import { Hono } from 'hono'
import type { AppEnv } from '../middleware/session'
import { matchFaq } from '../services/faq/match'
import { streamWenReply } from '../services/llm/reply'
import { clientIp, quotaKey, type ConsumeQuota } from '../services/rate-limit'

export interface ChatDeps {
  /** Modelo do LLM; `null` quando não há chave configurada (o chat responde só com o FAQ). */
  model: LanguageModel | null
  consumeQuota: ConsumeQuota
  saveExchange: (exchange: ChatExchange) => Promise<string>
  /** Segredo usado no hash do IP. */
  secret: string
}

/**
 * Chat público com a Wen. Primeiro a base de FAQ; fora dela, o LLM. A resposta vem em NDJSON
 * (`ChatEvent` por linha) para o texto aparecer enquanto é gerado. Conversas de quem está logado
 * são gravadas; a do visitante fica só no navegador.
 */
export function createChatRoute(deps: ChatDeps) {
  return new Hono<AppEnv>().post('/', async (c) => {
    const body: unknown = await c.req.json().catch(() => null)
    const parsed = chatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Mensagem inválida.', fields: fieldErrors(parsed.error) }, 400)
    }
    const { message, history, conversationId } = parsed.data
    const user = c.get('user')

    const quota = await deps.consumeQuota(
      quotaKey(deps.secret, user?.id, clientIp(c.req.raw.headers)),
    )
    if (!quota.allowed) {
      c.header('Retry-After', String(quota.retryAfter))
      return c.json(
        { error: 'Muitas mensagens em pouco tempo. Espere um pouco e tente de novo.' },
        429,
      )
    }

    const faq = matchFaq(message, history)
    const source: ChatReplySource = faq ? 'faq' : deps.model ? 'llm' : 'fallback'
    const signal = c.req.raw.signal
    const encoder = new TextEncoder()

    const body$ = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: ChatEvent) =>
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))

        send(faq ? { type: 'start', source, faqId: faq.entry.id } : { type: 'start', source })
        let reply = ''
        try {
          if (source === 'llm' && deps.model) {
            for await (const text of streamWenReply(deps.model, history, message, signal)) {
              reply += text
              send({ type: 'delta', text })
            }
          } else {
            reply = faq?.entry.answer ?? CHAT_FALLBACK_REPLY
            send({ type: 'delta', text: reply })
          }
        } catch (error) {
          if (!signal.aborted) console.error('[chat] falha ao gerar resposta', error)
          send({ type: 'error', message: CHAT_ERROR_REPLY })
          controller.close()
          return
        }

        let savedId: string | undefined
        if (user && reply.trim()) {
          try {
            savedId = await deps.saveExchange({
              conversationId,
              userId: user.id,
              question: message,
              reply: { content: reply, source: source === 'fallback' ? null : source },
            })
          } catch (error) {
            console.error('[chat] falha ao gravar a conversa', error)
          }
        }
        send({ type: 'end', conversationId: savedId })
        controller.close()
      },
    })

    return new Response(body$, {
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  })
}
