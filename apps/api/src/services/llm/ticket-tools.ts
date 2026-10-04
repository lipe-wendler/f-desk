import type { getClientTicket, listClientTickets } from '@f-desk/db'
import {
  isTicketTerminal,
  TICKET_CODE_PATTERN,
  TICKET_MESSAGE_MAX,
  TICKET_STATUS_LABEL,
  type TicketActionProposal,
  type TicketChoice,
  type TicketStatus,
} from '@f-desk/shared'
import { tool } from 'ai'
import { z } from 'zod'

/** Leitura dos chamados do cliente (as mesmas queries da rota de chamados, sempre com o id da sessão). */
export interface WenTicketStore {
  list: typeof listClientTickets
  get: typeof getClientTicket
}

/** Nomes das ferramentas de chamados (citados no prompt). */
export const TICKET_TOOL_NAMES = {
  list: 'listarMeusChamados',
  get: 'consultarChamado',
  reply: 'proporInformacao',
  cancel: 'proporCancelamento',
  resolve: 'proporResolucao',
} as const

/** Até quantos chamados a lista devolve ao modelo. */
const LIST_LIMIT = 10
/** Últimas mensagens públicas do chamado que vão ao modelo, e o tamanho máximo de cada uma. */
const MESSAGES_LIMIT = 5
const TEXT_LIMIT = 400

/** Status em que adicionar informação vale (resolvido não reabre por aqui: vira chamado novo). */
const ACCEPTS_INFO: readonly TicketStatus[] = ['open', 'in_progress', 'waiting_client']

const truncate = (text: string, max = TEXT_LIMIT) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
const day = (date: Date | string) => new Date(date).toISOString().slice(0, 10)

/** Código como o modelo escrever ("tkt-0042", " TKT-0042 "), normalizado e validado. */
const ticketCode = z
  .string()
  .trim()
  .transform((code) => code.toUpperCase())
  .pipe(z.string().regex(TICKET_CODE_PATTERN, { error: 'Use o código no formato TKT-0001.' }))

const SCOPES = { abertos: 'active', encerrados: 'done', todos: 'all' } as const

/**
 * Falha no banco vira um erro genérico: o SDK devolve a mensagem do erro ao modelo, e a do driver pode
 * trazer SQL ou detalhes internos que ele repetiria para a pessoa. O log fica só com o nome.
 */
async function guarded<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error(
      '[chat] falha ao consultar chamados para a Wen:',
      (error as Error)?.name ?? 'Erro',
    )
    // Sem `cause` de propósito: o erro do driver não pode chegar ao modelo.
    // eslint-disable-next-line preserve-caught-error
    throw new Error('Não consegui consultar os chamados agora.')
  }
}

/** Mesma resposta para chamado inexistente e de outra pessoa: nada vaza sobre chamados alheios. */
const NOT_FOUND = {
  encontrado: false,
  motivo: 'Chamado não encontrado entre os chamados desta pessoa. Confira o código com ela.',
}

/**
 * Ferramentas de chamados da Wen para um cliente logado. São montadas a cada pedido, numa closure com
 * o id **da sessão**: nenhum `inputSchema` aceita id de usuário, cliente ou e-mail, então o modelo
 * (ou um texto injetado na conversa) não tem como pedir os chamados de outra pessoa.
 *
 * - Leitura (`listarMeusChamados`, `consultarChamado`): devolvem só dados do próprio cliente, sem notas
 *   internas (`getClientTicket` já filtra) e sem e-mail.
 * - Ações (`proporInformacao`, `proporCancelamento`, `proporResolucao`): **não mudam nada**. O `execute`
 *   só confere dono e elegibilidade e devolve o resultado ao modelo; a proposta válida fica guardada e
 *   vira o evento `ticket-action-proposal`. A mudança só acontece quando o cliente confirma no cartão,
 *   pela rota de chamados (que confere tudo de novo).
 */
export function buildTicketTools({ userId, store }: { userId: string; store: WenTicketStore }) {
  let proposal: TicketActionProposal | undefined
  /** Última lista consultada, para a tela mostrar os chamados e a pessoa escolher um. */
  let listed: TicketChoice[] | undefined

  const find = (code: string) => guarded(() => store.get(userId, code))

  /** Guarda a proposta (a mais nova vale) e diz ao modelo o que falar. */
  function propose(next: TicketActionProposal) {
    proposal = next
    return {
      proposta: 'pronta',
      instrucao:
        'Nada foi feito ainda. Diga em uma frase o que preparou e que a pessoa confirma no cartão abaixo.',
    }
  }

  const refuse = (motivo: string) => ({ proposta: 'recusada', motivo })

  const tools = {
    [TICKET_TOOL_NAMES.list]: tool({
      description:
        'Lista os chamados da pessoa logada (até 10, do mais recente): código, assunto, status e data de abertura.',
      inputSchema: z.object({
        escopo: z
          .enum(['abertos', 'encerrados', 'todos'])
          .default('abertos')
          .describe('abertos: em andamento; encerrados: resolvidos, fechados e cancelados.'),
      }),
      execute: async ({ escopo }) => {
        const { tickets, total } = await guarded(() =>
          store.list({ clientId: userId, scope: SCOPES[escopo], limit: LIST_LIMIT, offset: 0 }),
        )
        listed = tickets.map((t) => ({
          code: t.code,
          subject: t.subject,
          status: t.status,
          createdAt: new Date(t.createdAt).toISOString(),
        }))
        return {
          total,
          instrucao:
            'A lista aparece na tela para a pessoa escolher. Não repita todos os itens: diga quantos são e peça para ela escolher um (ou citar o código).',
          chamados: tickets.map((t) => ({
            codigo: t.code,
            assunto: t.subject,
            status: TICKET_STATUS_LABEL[t.status],
            abertoEm: day(t.createdAt),
          })),
        }
      },
    }),

    [TICKET_TOOL_NAMES.get]: tool({
      description:
        'Mostra um chamado da pessoa logada pelo código: status, descrição e as últimas mensagens públicas.',
      inputSchema: z.object({ codigo: ticketCode }),
      execute: async ({ codigo }) => {
        const found = await find(codigo)
        if (!found) return NOT_FOUND
        return {
          encontrado: true,
          codigo: found.code,
          assunto: found.subject,
          status: TICKET_STATUS_LABEL[found.status],
          abertoEm: day(found.createdAt),
          tecnico: found.assigneeName,
          podeCancelar: found.canCancel,
          descricao: truncate(found.description),
          ultimasMensagens: found.messages.slice(-MESSAGES_LIMIT).map((m) => ({
            de: m.author.fromClient ? 'cliente' : `equipe (${m.author.name})`,
            em: day(m.createdAt),
            texto: truncate(m.content),
          })),
        }
      },
    }),

    [TICKET_TOOL_NAMES.reply]: tool({
      description:
        'Prepara uma informação para adicionar a um chamado em andamento da pessoa. Ela confirma antes de enviar.',
      inputSchema: z.object({
        codigo: ticketCode,
        mensagem: z
          .string()
          .trim()
          .min(1)
          .max(TICKET_MESSAGE_MAX)
          .describe(
            'O texto que vai para a equipe, em primeira pessoa, como se fosse a pessoa escrevendo.',
          ),
      }),
      execute: async ({ codigo, mensagem }) => {
        const found = await find(codigo)
        if (!found) return NOT_FOUND
        if (!ACCEPTS_INFO.includes(found.status)) {
          const status = TICKET_STATUS_LABEL[found.status].toLowerCase()
          return refuse(
            `O chamado ${found.code} está ${status} e não recebe informação nova por aqui. ` +
              `Ofereça abrir um chamado novo com proporChamado, citando ${found.code} na descrição.`,
          )
        }
        return propose({
          action: 'reply',
          code: found.code,
          subject: found.subject,
          message: mensagem,
        })
      },
    }),

    [TICKET_TOOL_NAMES.cancel]: tool({
      description:
        'Prepara o cancelamento de um chamado da pessoa (só enquanto ninguém da equipe respondeu). Ela confirma antes.',
      inputSchema: z.object({ codigo: ticketCode }),
      execute: async ({ codigo }) => {
        const found = await find(codigo)
        if (!found) return NOT_FOUND
        if (!found.canCancel)
          return refuse(
            `O chamado ${found.code} não pode mais ser cancelado: a equipe já começou o atendimento ` +
              'ou ele já foi encerrado. Se o problema foi resolvido, ofereça proporResolucao.',
          )
        return propose({ action: 'cancel', code: found.code, subject: found.subject })
      },
    }),

    [TICKET_TOOL_NAMES.resolve]: tool({
      description:
        'Prepara o fechamento de um chamado da pessoa como resolvido por ela ("já resolvi"). Ela confirma antes.',
      inputSchema: z.object({ codigo: ticketCode }),
      execute: async ({ codigo }) => {
        const found = await find(codigo)
        if (!found) return NOT_FOUND
        if (isTicketTerminal(found.status))
          return refuse(`O chamado ${found.code} já está encerrado; não há o que fechar.`)
        return propose({ action: 'resolve', code: found.code, subject: found.subject })
      },
    }),
  }

  return {
    tools,
    /** A última proposta válida desta resposta (ou nenhuma). */
    proposal: () => proposal,
    /** Os chamados da última lista consultada (ou nenhum). */
    listed: () => listed,
  }
}
