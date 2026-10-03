import type { ChatExchange } from '@f-desk/db'
import {
  CHAT_ERROR_REPLY,
  CHAT_FALLBACK_REPLY,
  CHAT_PROPOSAL_REPLY,
  CHAT_TICKET_DETAILS_REPLY,
  CHAT_TICKET_REQUEST_REPLY,
  FAQ,
  GUIDED_FEEDBACK,
  chatRequestSchema,
  fallbackTitle,
  fieldErrors,
  proposalFromMessages,
  type ChatEvent,
  type ChatMessage,
  type ChatReplySource,
  type TicketProposal,
} from '@f-desk/shared'
import type { LanguageModel } from 'ai'
import { Hono } from 'hono'
import type { AppEnv } from '../middleware/session'
import { isTicketRequest } from '../services/faq/intent'
import { matchFaq } from '../services/faq/match'
import { describeConversation, type ConversationMeta } from '../services/llm/meta'
import { streamWenReply } from '../services/llm/reply'
import { clientIp, quotaKey, type ConsumeQuota } from '../services/rate-limit'

/** Respostas do "Resolveu?" que ficam fora da descrição do chamado montado sem LLM. */
const FEEDBACK_LABELS = new Set([GUIDED_FEEDBACK.resolved.label, GUIDED_FEEDBACK.unresolved.label])

export interface ChatDeps {
  /** Modelo do LLM; `null` quando não há chave configurada (o chat responde só com o FAQ). */
  model: LanguageModel | null
  consumeQuota: ConsumeQuota
  saveExchange: (exchange: ChatExchange) => Promise<string>
  /** Segredo usado no hash do IP. */
  secret: string
  /** Título e tipo da conversa nova pelo LLM (padrão: `describeConversation`). Injetável nos testes. */
  describe?: typeof describeConversation
  /**
   * Histórico gravado de uma conversa do usuário (`null` se não for dele). Com conversa gravada, o
   * contexto do LLM vem daqui, e não do `history` do corpo, que o navegador pode forjar.
   */
  loadHistory?: (userId: string, conversationId: string) => Promise<ChatMessage[] | null>
}

/**
 * Chat público com a Wen. Primeiro a base de FAQ; fora dela, o LLM. A resposta vem em NDJSON
 * (`ChatEvent` por linha) para o texto aparecer enquanto é gerado. Conversas de quem está logado
 * são gravadas; a do visitante fica só no navegador.
 */
export function createChatRoute(deps: ChatDeps) {
  return (
    new Hono<AppEnv>()
      // Selo de status do atendimento: com LLM o Wen responde qualquer coisa; sem, só as respostas prontas.
      .get('/status', (c) => c.json({ llm: deps.model !== null }))
      .post('/', async (c) => {
        const body: unknown = await c.req.json().catch(() => null)
        const parsed = chatRequestSchema.safeParse(body)
        if (!parsed.success) {
          return c.json({ error: 'Mensagem inválida.', fields: fieldErrors(parsed.error) }, 400)
        }
        const { message, conversationId, faqId } = parsed.data
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

        // Logado com conversa: o contexto é o gravado (ou nenhum, se a conversa não for dele; o
        // `saveExchange` abre uma nova). O `history` do corpo só vale sem conversa gravada: visitante
        // ou quem entrou no meio da conversa e ainda não tem nada gravado.
        const usesSaved = Boolean(user && conversationId && deps.loadHistory)
        const history = usesSaved
          ? ((await deps.loadHistory!(user!.id, conversationId!)) ?? [])
          : parsed.data.history

        // Opção do atendimento guiado: a resposta pronta escolhida, sem depender da busca por palavras.
        const chosen = faqId ? FAQ.find((entry) => entry.id === faqId) : undefined
        // Pedido de chamado não vai para a resposta pronta "como abrir": o Wen prepara o chamado.
        const ticketRequested = !chosen && isTicketRequest(message)
        const faq = chosen
          ? { entry: chosen, score: 1 }
          : ticketRequested
            ? null
            : matchFaq(message, history)
        const source: ChatReplySource = faq ? 'faq' : deps.model ? 'llm' : 'fallback'
        const signal = c.req.raw.signal
        const encoder = new TextEncoder()

        const body$ = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: ChatEvent) =>
              controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))

            send(faq ? { type: 'start', source, faqId: faq.entry.id } : { type: 'start', source })
            let reply = ''
            let proposal: TicketProposal | undefined
            try {
              if (source === 'llm' && deps.model) {
                for await (const part of streamWenReply(deps.model, history, message, {
                  loggedIn: Boolean(user),
                  ticketRequested,
                  abortSignal: signal,
                })) {
                  if (part.type === 'proposal') {
                    proposal = { subject: part.subject, description: part.description }
                    continue
                  }
                  reply += part.text
                  send({ type: 'delta', text: part.text })
                }
                // O modelo só chamou a ferramenta: a conversa ainda precisa de uma fala do Wen.
                if (proposal && !reply.trim()) {
                  reply = CHAT_PROPOSAL_REPLY
                  send({ type: 'delta', text: reply })
                }
              } else if (faq) {
                reply = faq.entry.answer
                send({ type: 'delta', text: reply })
              } else {
                // Sem LLM e sem resposta pronta: o chamado sai do que o cliente contou. Ficam de fora
                // o "Resolveu" / "Não resolveu" do atendimento guiado e os próprios pedidos de chamado.
                const told = [...history.filter((m) => m.role === 'user').map((m) => m.content)]
                  .concat(ticketRequested ? [] : [message])
                  .filter((m) => !FEEDBACK_LABELS.has(m) && !isTicketRequest(m))
                if (told.length) proposal = proposalFromMessages(told)
                reply = !ticketRequested
                  ? CHAT_FALLBACK_REPLY
                  : proposal
                    ? CHAT_TICKET_REQUEST_REPLY
                    : CHAT_TICKET_DETAILS_REPLY
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
            // A proposta vai antes do fim; o chamado só é aberto quando o cliente confirmar.
            if (proposal) send({ type: 'ticket-proposal', ...proposal })
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
  )
}
