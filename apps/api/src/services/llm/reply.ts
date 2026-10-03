import {
  ticketProposalSchema,
  type ChatMessage,
  type TicketActionProposal,
  type TicketProposal,
} from '@f-desk/shared'
import { stepCountIs, streamText, tool, type LanguageModel, type ModelMessage } from 'ai'
import { WEN_INSTRUCTIONS } from './prompt'
import { buildTicketTools, type WenTicketStore } from './ticket-tools'

/** Mensagens anteriores que vão para o modelo (as mais recentes). */
const HISTORY_LIMIT = 12
const MAX_OUTPUT_TOKENS = 800
/**
 * Passos do modelo por mensagem: consultar um chamado, propor uma ação e responder. Cada passo é uma
 * chamada ao provedor; a mensagem conta uma vez na cota do chat, e este teto limita o custo dela.
 */
export const MAX_STEPS = 3

/** Quem está conversando: decide a nota de contexto e as ferramentas. */
export type WenAudience = 'visitor' | 'client' | 'staff'

/** Nota que vai junto da mensagem atual (e não nas instruções, para o prefixo seguir em cache). */
export function contextNote(audience: WenAudience) {
  if (audience === 'client')
    return 'Contexto do sistema: a pessoa já está logada como cliente; as ferramentas de chamados estão disponíveis.'
  if (audience === 'staff')
    return 'Contexto do sistema: a pessoa já está logada com uma conta da equipe; não há ferramentas de chamados.'
  return 'Contexto do sistema: a pessoa é visitante, sem login.'
}

/** Nota extra quando a mensagem é um pedido de chamado: o modelo prepara em vez de explicar como abrir. */
export const TICKET_REQUEST_NOTE =
  'Contexto do sistema: a pessoa pediu um chamado ou alguém da equipe. Se ela já contou o problema, chame proporChamado agora; se ainda não contou, pergunte o que está acontecendo.'

/** Nome da ferramenta que o modelo chama quando não consegue resolver (citado no prompt). */
export const PROPOSE_TICKET_TOOL = 'proporChamado'

/**
 * `proporChamado` não tem `execute`: chamar não abre nada. A chamada vira uma proposta na tela, e o
 * chamado só é aberto quando o cliente confirma (pela rota de chamados, que confere o perfil).
 * Visitante e equipe só têm esta ferramenta.
 */
const proposeTicket = tool({
  description:
    'Prepara um chamado para a equipe técnica quando você não consegue resolver o caso ou a pessoa pede um técnico. A pessoa confere e confirma antes de abrir.',
  inputSchema: ticketProposalSchema,
})

export type WenReplyPart =
  | { type: 'text'; text: string }
  | ({ type: 'proposal' } & TicketProposal)
  | { type: 'action'; proposal: TicketActionProposal }

/**
 * Resposta da Wen em streaming: os pedaços de texto conforme chegam e, se o modelo chamar
 * `proporChamado`, a proposta de chamado. Com `tickets` (só cliente logado, com o id da sessão), a
 * Wen também consulta os chamados dele e propõe ações (`ticket-tools.ts`); a última proposta válida
 * vem no fim. Os resultados das ferramentas ficam só nesta chamada (não são gravados na conversa).
 * Lança o erro do provedor (chave inválida, cota, indisponibilidade) para a rota tratar.
 */
export async function* streamWenReply(
  model: LanguageModel,
  history: ChatMessage[],
  message: string,
  options: {
    audience: WenAudience
    ticketRequested?: boolean
    abortSignal?: AbortSignal
    tickets?: { userId: string; store: WenTicketStore }
  },
): AsyncGenerator<WenReplyPart> {
  const ticketTools =
    options.audience === 'client' && options.tickets ? buildTicketTools(options.tickets) : undefined
  const messages: ModelMessage[] = [
    ...history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: [
        { type: 'text', text: contextNote(options.audience) },
        ...(options.ticketRequested ? [{ type: 'text' as const, text: TICKET_REQUEST_NOTE }] : []),
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
    tools: { [PROPOSE_TICKET_TOOL]: proposeTicket, ...ticketTools?.tools },
    // Chamar `proporChamado` encerra a resposta, como antes dos vários passos: a proposta (ou a
    // chamada inválida, que vira erro de ferramenta) não deve fazer o modelo continuar e repetir a fala.
    stopWhen: [
      stepCountIs(MAX_STEPS),
      ({ steps }) =>
        steps
          .at(-1)
          ?.content.some(
            (part) =>
              (part.type === 'tool-call' || part.type === 'tool-error') &&
              part.toolName === PROPOSE_TICKET_TOOL,
          ) ?? false,
    ],
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
  const action = ticketTools?.proposal()
  if (action) yield { type: 'action', proposal: action }
}
