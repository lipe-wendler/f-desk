import type { ChatExchange } from '@f-desk/db'
import {
  CHAT_ERROR_REPLY,
  CHAT_FALLBACK_REPLY,
  chatRequestSchema,
  fallbackTitle,
  fieldErrors,
  type ChatEvent,
  type ChatReplySource,
} from '@f-desk/shared'
import type { LanguageModel } from 'ai'
import { Hono } from 'hono'
import type { AppEnv } from '../middleware/session'
import { matchFaq } from '../services/faq/match'
import { describeConversation, type ConversationMeta } from '../services/llm/meta'
import { streamWenReply } from '../services/llm/reply'
import { clientIp, quotaKey, type ConsumeQuota } from '../services/rate-limit'

export interface ChatDeps {
  /** Modelo do LLM; `null` quando não há chave configurada (o chat responde só com o FAQ). */
  model: LanguageModel | null
  consumeQuota: ConsumeQuota
  saveExchange: (exchange: ChatExchange) => Promise<string>
  /** Segredo usado no hash do IP. */
  secret: string
  /** Título e tipo da conversa nova pelo LLM (padrão: `describeConversation`). Injetável nos testes. */
  describe?: typeof describeConversation
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
            for await (const text of streamWenReply(deps.model, history, message, {
              loggedIn: Boolean(user),
              abortSignal: signal,
            })) {
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

        /**
         * Título e tipo da conversa. Resposta pronta: a pergunta do FAQ. LLM: um resumo pedido ao
         * modelo, só na conversa nova (uma chamada extra pequena). Sem nada disso, a própria mensagem.
         */
        async function conversationMeta(isNew: boolean): Promise<ConversationMeta | undefined> {
          if (faq) return { title: faq.entry.question, kind: faq.entry.kind }
          if (source === 'llm' && deps.model) {
            if (!isNew) return undefined
            const described = await (deps.describe ?? describeConversation)(deps.model, {
              history,
              message,
              reply,
            })
            if (described) return described
          }
          return {
            title: fallbackTitle(history.find((m) => m.role === 'user')?.content ?? message),
            kind: null,
          }
        }

        let savedId: string | undefined
        let meta: ConversationMeta | undefined
        if (user && reply.trim()) {
          meta = await conversationMeta(!conversationId)
          try {
            savedId = await deps.saveExchange({
              conversationId,
              userId: user.id,
              question: message,
              reply: { content: reply, source: source === 'fallback' ? null : source },
              meta,
            })
          } catch (error) {
            console.error('[chat] falha ao gravar a conversa', error)
          }
        }
        // Título e tipo só vão para a tela na conversa nova (numa existente o banco mantém os primeiros).
        send(
          savedId && meta && !conversationId
            ? { type: 'end', conversationId: savedId, title: meta.title, kind: meta.kind }
            : { type: 'end', conversationId: savedId },
        )
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
