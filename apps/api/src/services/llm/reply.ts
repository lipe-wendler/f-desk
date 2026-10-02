import { ticketProposalSchema, type ChatMessage, type TicketProposal } from '@f-desk/shared'
import { streamText, tool, type LanguageModel, type ModelMessage } from 'ai'
import { WEN_INSTRUCTIONS } from './prompt'

/** Mensagens anteriores que vão para o modelo (as mais recentes). */
const HISTORY_LIMIT = 12
const MAX_OUTPUT_TOKENS = 800

/** Nota que vai junto da mensagem atual (e não nas instruções, para o prefixo seguir em cache). */
export function contextNote(loggedIn: boolean) {
  return loggedIn
    ? 'Contexto do sistema: a pessoa já está logada como cliente.'
    : 'Contexto do sistema: a pessoa é visitante, sem login.'
}

/** Nome da ferramenta que o modelo chama quando não consegue resolver (citado no prompt). */
export const PROPOSE_TICKET_TOOL = 'proporChamado'

/**
 * A ferramenta não tem `execute`: chamar não abre nada. A chamada vira uma proposta na tela, e o
 * chamado só é aberto quando o cliente confirma (pela rota de chamados, que confere o perfil).
 */
const tools = {
  [PROPOSE_TICKET_TOOL]: tool({
    description:
      'Prepara um chamado para a equipe técnica quando você não consegue resolver o caso ou a pessoa pede um técnico. A pessoa confere e confirma antes de abrir.',
    inputSchema: ticketProposalSchema,
  }),
}

export type WenReplyPart = { type: 'text'; text: string } | ({ type: 'proposal' } & TicketProposal)

/**
 * Resposta da Wen em streaming: os pedaços de texto conforme chegam e, se o modelo chamar
 * `proporChamado`, a proposta de chamado. Lança o erro do provedor (chave inválida, cota,
 * indisponibilidade) para a rota tratar.
 */
export async function* streamWenReply(
  model: LanguageModel,
  history: ChatMessage[],
  message: string,
  options: { loggedIn: boolean; abortSignal?: AbortSignal },
): AsyncGenerator<WenReplyPart> {
  const messages: ModelMessage[] = [
    ...history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: [
        { type: 'text', text: contextNote(options.loggedIn) },
        { type: 'text', text: message },
      ],
    },
  ]

  const result = streamText({
    model,
    // Só o Anthropic precisa de marcação explícita para cachear o prefixo; os outros cacheiam sozinhos.
    instructions: {
      role: 'system',
      content: WEN_INSTRUCTIONS,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    },
    messages,
    tools,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    abortSignal: options.abortSignal,
  })

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') yield { type: 'text', text: part.text }
    else if (part.type === 'tool-call' && part.toolName === PROPOSE_TICKET_TOOL && !part.invalid) {
      // Confere de novo: o provedor pode devolver campos fora dos limites do chamado.
      const proposal = ticketProposalSchema.safeParse(part.input)
      if (proposal.success) yield { type: 'proposal', ...proposal.data }
    } else if (part.type === 'error') throw part.error
  }
}
