import type { RequestKind } from './request-kind'
import { z } from 'zod'
import { FAQ } from './faq'
import {
  chatMessageSchema,
  TICKET_CODE_PATTERN,
  TICKET_MESSAGE_MAX,
  type ChatSource,
  type TicketStatus,
} from './tickets'

/** Tamanho máximo de uma mensagem digitada no chat. */
export const CHAT_INPUT_MAX = 1000
/** Mensagens anteriores enviadas junto com a pergunta (contexto do LLM). */
export const CHAT_HISTORY_MAX = 20

/** Pedido ao chat. O visitante manda o histórico do navegador; o cliente logado também manda o `conversationId`. */
export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { error: 'Escreva a sua mensagem.' })
    .max(CHAT_INPUT_MAX, { error: `Use no máximo ${CHAT_INPUT_MAX} caracteres.` }),
  history: z.array(chatMessageSchema).max(CHAT_HISTORY_MAX).default([]),
  conversationId: z.uuid().optional(),
  /** Resposta pronta escolhida no atendimento guiado: a API responde direto por ela, sem LLM. */
  faqId: z
    .string()
    .refine((id) => FAQ.some((entry) => entry.id === id), {
      error: 'Resposta pronta desconhecida.',
    })
    .optional(),
})
export type ChatRequest = z.infer<typeof chatRequestSchema>

/**
 * Origem da resposta: base de FAQ, LLM ou `fallback` (sem resposta pronta e LLM indisponível).
 * No banco, `fallback` é gravado com `source` nulo.
 */
export type ChatReplySource = ChatSource | 'fallback'

/** Eventos da resposta do chat, um JSON por linha (NDJSON). */
export type ChatEvent =
  | { type: 'start'; source: ChatReplySource; faqId?: string }
  | { type: 'delta'; text: string }
  | {
      type: 'end'
      conversationId?: string
      /** Título e tipo da conversa, quando ela acabou de ser criada no servidor. */
      title?: string
      kind?: RequestKind | null
    }
  /** O Wen não resolveu e preparou um chamado: o cliente confere e confirma (nada é aberto sem ele). */
  | { type: 'ticket-proposal'; subject: string; description: string }
  /**
   * A Wen propôs uma ação num chamado do cliente logado. O servidor já conferiu o dono e se a ação
   * vale para o status; nada muda até o cliente confirmar no cartão (pela rota de chamados).
   */
  | ({ type: 'ticket-action-proposal' } & TicketActionProposal)
  /** O que a Wen está fazendo com as ferramentas (aparece na hora, como linhas acima da fala). */
  | ({ type: 'tool' } & ToolActivity)
  /** Chamados que a Wen listou: a pessoa escolhe um na tela para continuar a conversa sobre ele. */
  | { type: 'ticket-list'; tickets: TicketChoice[] }
  | { type: 'error'; message: string }

export const CHAT_FALLBACK_REPLY =
  'Não encontrei uma resposta pronta para isso. Preparei um chamado para um técnico olhar o seu caso: confira os dados abaixo e confirme.'

/** Pedido de chamado atendido sem LLM: o chamado sai do que o cliente já contou. */
export const CHAT_TICKET_REQUEST_REPLY =
  'Preparei um chamado para a equipe técnica com o que você contou: confira os dados e confirme.'

/** Pedido de chamado antes de contar o problema (sem LLM): o Wen pergunta antes de preparar. */
export const CHAT_TICKET_DETAILS_REPLY =
  'Posso preparar o chamado. Antes, me conte o que está acontecendo: o que aparece na tela, desde quando e o que você já tentou.'

/** Texto da resposta quando o LLM só propõe o chamado, sem escrever nada antes. */
export const CHAT_PROPOSAL_REPLY =
  'Não consegui resolver por aqui. Preparei um chamado para a equipe técnica: confira os dados abaixo e confirme.'

/** Texto da resposta quando o LLM só propõe uma ação num chamado, sem escrever nada antes. */
export const CHAT_ACTION_REPLY =
  'Preparei a ação no seu chamado. Nada foi feito ainda: confira e confirme no cartão abaixo.'

/** Texto da resposta quando o LLM só lista os chamados, sem escrever nada. */
export const CHAT_LIST_REPLY = 'Estes são os seus chamados. Escolha um abaixo para continuarmos.'

/** Fala do Wen gravada na conversa quando o chamado é aberto pela proposta. */
export const ticketCreatedReply = (code: string) =>
  `Abri o chamado ${code}. Um técnico vai assumir o caso, e você acompanha as respostas em Meus chamados.`

export const CHAT_ERROR_REPLY = 'Não consegui responder agora. Tente de novo em instantes.'

/**
 * Ações que a Wen pode propor num chamado do próprio cliente: adicionar uma informação (resposta no
 * chamado, sem reabrir resolvido), cancelar e "já resolvi".
 */
export const TICKET_ACTIONS = ['reply', 'cancel', 'resolve'] as const
export type TicketAction = (typeof TICKET_ACTIONS)[number]

export const TICKET_ACTION_LABEL: Record<TicketAction, string> = {
  reply: 'Adicionar ao chamado',
  cancel: 'Cancelar chamado',
  resolve: 'Fechar como resolvido',
}

/** Proposta de ação que vai para a tela: o código e o assunto vêm do banco, a mensagem da Wen. */
export const ticketActionProposalSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reply'),
    code: z.string().regex(TICKET_CODE_PATTERN),
    subject: z.string(),
    message: z.string().trim().min(1).max(TICKET_MESSAGE_MAX),
  }),
  z.object({
    action: z.enum(['cancel', 'resolve']),
    code: z.string().regex(TICKET_CODE_PATTERN),
    subject: z.string(),
  }),
])
export type TicketActionProposal = z.infer<typeof ticketActionProposalSchema>

/** Ferramentas da Wen que aparecem como atividade na conversa. */
export const WEN_TOOLS = [
  'listarMeusChamados',
  'consultarChamado',
  'proporInformacao',
  'proporCancelamento',
  'proporResolucao',
  'proporChamado',
] as const
export type WenTool = (typeof WEN_TOOLS)[number]

/**
 * Uma chamada de ferramenta da Wen: `running` enquanto executa; depois `done`, `refused` (a ação
 * não vale para o chamado), `not_found` (chamado que não é da pessoa ou não existe) ou `error`.
 * `code` e `count` vêm do servidor (o código normalizado e quantos chamados a lista trouxe).
 */
export interface ToolActivity {
  id: string
  tool: WenTool
  status: 'running' | 'done' | 'refused' | 'not_found' | 'error'
  code?: string
  scope?: 'abertos' | 'encerrados' | 'todos'
  count?: number
}

/** Chamado da lista que a Wen mostra para a pessoa escolher. */
export interface TicketChoice {
  code: string
  subject: string
  status: TicketStatus
  createdAt: string
}

const of = (code?: string) => code ?? 'chamado'

/** Texto da linha de atividade, no presente enquanto roda e no passado quando termina. */
export function toolActivityLabel(activity: ToolActivity): string {
  const { tool, status, code, scope, count } = activity
  const ticket = of(code)
  if (status === 'error') return 'Não consegui consultar os chamados agora'
  if (status === 'not_found') return `Não encontrei o ${ticket} entre os seus chamados`
  const running = status === 'running'
  switch (tool) {
    case 'listarMeusChamados': {
      const which = scope === 'encerrados' ? 'encerrados' : scope === 'todos' ? '' : 'em aberto'
      const label = `seus chamados${which ? ` ${which}` : ''}`
      return running
        ? `Consultando ${label}…`
        : `Consultei ${label}${count === undefined ? '' : ` (${count})`}`
    }
    case 'consultarChamado':
      return running ? `Consultando o ${ticket}…` : `Consultei o ${ticket}`
    case 'proporInformacao':
      if (status === 'refused') return `O ${ticket} não recebe informação nova por aqui`
      return running
        ? `Preparando a informação para o ${ticket}…`
        : `Preparei uma informação para o ${ticket}`
    case 'proporCancelamento':
      if (status === 'refused') return `O ${ticket} não pode mais ser cancelado`
      return running
        ? `Preparando o cancelamento do ${ticket}…`
        : `Preparei o cancelamento do ${ticket}`
    case 'proporResolucao':
      if (status === 'refused') return `O ${ticket} já está encerrado`
      return running
        ? `Preparando o fechamento do ${ticket}…`
        : `Preparei o fechamento do ${ticket}`
    case 'proporChamado':
      return running ? 'Preparando um chamado…' : 'Preparei um chamado para a equipe'
  }
}
