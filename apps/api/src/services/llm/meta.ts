import {
  CONVERSATION_TITLE_MAX,
  REQUEST_KIND_IDS,
  type ChatMessage,
  type RequestKind,
} from '@f-desk/shared'
import { generateText, Output, type LanguageModel } from 'ai'
import { z } from 'zod'

/** Título e tipo da conversa, para a lista do atendimento. */
export interface ConversationMeta {
  title: string
  kind: RequestKind | null
}

const metaSchema = z.object({
  title: z.string().min(2).max(CONVERSATION_TITLE_MAX),
  kind: z.enum(REQUEST_KIND_IDS),
})

const INSTRUCTIONS = `Você nomeia conversas de suporte técnico em português do Brasil.
Responda só com o objeto pedido.
- title: até 6 palavras, sem ponto final, descrevendo o problema ou a dúvida (ex.: "Conta bloqueada após troca de senha").
- kind: access (login, senha, permissão), data (arquivos, relatórios, dados errados ou perdidos),
  integration (e-mail, celular, VPN, sistemas externos), question (dúvida de uso), bug (algo quebrado
  ou com erro) ou feature (sugestão ou pedido de algo novo).`

/** Limite curto: o título não pode atrasar o fim da resposta que a pessoa já está lendo. */
const TIMEOUT_MS = 4000
const EXCERPT = 600

/**
 * Pede ao modelo um título curto e o tipo da conversa nova. Uma chamada pequena, só na primeira
 * troca gravada. Devolve `null` em qualquer falha (a rota cai no título de reserva).
 */
export async function describeConversation(
  model: LanguageModel,
  input: { history: ChatMessage[]; message: string; reply: string },
): Promise<ConversationMeta | null> {
  const transcript = [...input.history.slice(-4), { role: 'user', content: input.message }]
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'Wen'}: ${m.content.slice(0, EXCERPT)}`)
    .concat(`Wen: ${input.reply.slice(0, EXCERPT)}`)
    .join('\n')
  try {
    const { output } = await generateText({
      model,
      system: INSTRUCTIONS,
      prompt: transcript,
      output: Output.object({ schema: metaSchema }),
      maxOutputTokens: 80,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const title = output.title.replace(/\s+/g, ' ').trim().replace(/\.+$/, '').trimEnd()
    return title ? { title, kind: output.kind } : null
  } catch (error) {
    console.error('[chat] falha ao gerar o título da conversa', error)
    return null
  }
}
