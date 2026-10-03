import {
  canClientCancel,
  TERMINAL_TICKET_STATUSES,
  ticketCreatedReply,
  type ChatMessage,
  type TicketStatus,
} from '@f-desk/shared'
import { and, asc, count, desc, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm'
import { db } from '../client'
import { conversation, conversationMessage, ticket, ticketMessage } from '../schema'
import { unchangedSince, updateWithMessage, WRITE_ATTEMPTS } from './ticket-writes'

export interface NewTicket {
  clientId: string
  subject: string
  description: string
  /** Conversa já gravada do cliente (chat logado). Tem prioridade sobre `transcript`. */
  conversationId?: string
  /** Conversa que estava só no navegador (visitante que entrou para abrir o chamado). */
  transcript: ChatMessage[]
}

/** A fala de chamado aberto com o código vindo do banco (o código só existe depois do INSERT). */
const [CREATED_BEFORE, CREATED_AFTER] = ticketCreatedReply('\u0000').split('\u0000') as [
  string,
  string,
]

/**
 * Abre o chamado e liga a conversa (existente ou criada a partir da transcrição). Na conversa fica a
 * fala do Wen que registra o chamado, ligada a ele, para o cartão do chamado continuar ali depois.
 * Tudo num `batch`, que é transacional no driver HTTP: entra tudo junto ou nada.
 */
export async function createTicket({
  clientId,
  subject,
  description,
  conversationId,
  transcript,
}: NewTicket) {
  let linkedId: string | null = null
  if (conversationId) {
    const [own] = await db
      .select({ id: conversation.id })
      .from(conversation)
      .where(and(eq(conversation.id, conversationId), eq(conversation.userId, clientId)))
      .limit(1)
    linkedId = own?.id ?? null
  }

  const ticketId = crypto.randomUUID()
  const returning = { id: ticket.id, code: ticket.code, conversationId: ticket.conversationId }
  const insertTicket = (convId: string | null) =>
    db
      .insert(ticket)
      .values({ id: ticketId, clientId, subject, description, conversationId: convId })
      .returning(returning)
  const recordInConversation = (convId: string) =>
    [
      db.execute(sql`
        insert into ${conversationMessage} (conversation_id, role, content, ticket_id)
        select ${convId}::uuid, 'assistant', ${CREATED_BEFORE}::text || ${ticket.code} || ${CREATED_AFTER}::text, ${ticket.id}
        from ${ticket} where ${ticket.id} = ${ticketId}`),
      db
        .update(conversation)
        .set({ updatedAt: sql`now()` })
        .where(eq(conversation.id, convId)),
    ] as const

  if (!linkedId && transcript.length > 0) {
    const newId = crypto.randomUUID()
    const [, , created] = await db.batch([
      db.insert(conversation).values({ id: newId, userId: clientId }),
      db.insert(conversationMessage).values(
        transcript.map((m) => ({
          conversationId: newId,
          role: m.role,
          content: m.content,
          imported: true,
        })),
      ),
      insertTicket(newId),
      ...recordInConversation(newId),
    ])
    return created[0]!
  }

  if (linkedId) {
    const [created] = await db.batch([insertTicket(linkedId), ...recordInConversation(linkedId)])
    return created[0]!
  }

  const [created] = await insertTicket(null)
  return created!
}

/** Filtros da lista do cliente: em aberto (pedem ação) ou encerrados (resolvidos, fechados e cancelados). */
export const TICKET_SCOPES = {
  active: ['open', 'in_progress', 'waiting_client'],
  done: ['resolved', 'closed', 'cancelled'],
} as const satisfies Record<string, readonly TicketStatus[]>
export type TicketScope = keyof typeof TICKET_SCOPES | 'all'

export async function listClientTickets(params: {
  clientId: string
  scope: TicketScope
  limit: number
  offset: number
}) {
  const filters: SQL[] = [eq(ticket.clientId, params.clientId)]
  if (params.scope !== 'all') filters.push(inArray(ticket.status, [...TICKET_SCOPES[params.scope]]))
  const where = and(...filters)

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        code: ticket.code,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      })
      .from(ticket)
      .where(where)
      .orderBy(desc(ticket.updatedAt))
      .limit(params.limit)
      .offset(params.offset),
    db.select({ n: count() }).from(ticket).where(where),
  ])
  return { tickets: rows, total: totalRow?.n ?? 0 }
}

async function findClientTicket(clientId: string, code: string) {
  const [row] = await db
    .select({ id: ticket.id, status: ticket.status })
    .from(ticket)
    .where(and(eq(ticket.code, code), eq(ticket.clientId, clientId)))
    .limit(1)
  return row ?? null
}

/** Chamado do cliente com as mensagens visíveis para ele (sem notas internas) e a conversa de origem. */
export async function getClientTicket(clientId: string, code: string) {
  const found = await db.query.ticket.findFirst({
    where: and(eq(ticket.code, code), eq(ticket.clientId, clientId)),
    columns: {
      code: true,
      subject: true,
      description: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      closedAt: true,
      cancelledAt: true,
      closeReason: true,
    },
    with: {
      assignee: { columns: { name: true } },
      messages: {
        where: eq(ticketMessage.internal, false),
        orderBy: asc(ticketMessage.id),
        columns: { id: true, content: true, createdAt: true },
        with: { author: { columns: { id: true, name: true, role: true } } },
      },
      conversation: {
        columns: { id: true },
        with: {
          messages: {
            orderBy: asc(conversationMessage.id),
            columns: { role: true, content: true, source: true, imported: true },
          },
        },
      },
    },
  })
  if (!found) return null
  const { assignee, messages, conversation: origin, ...rest } = found
  return {
    ...rest,
    canCancel: canClientCancel(
      rest.status,
      messages.map((m) => m.author.id),
      clientId,
    ),
    assigneeName: assignee?.name ?? null,
    messages: messages.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      author: {
        name: m.author.name,
        fromClient: m.author.id === clientId,
      },
    })),
    transcript: origin?.messages ?? [],
  }
}

export type ClientReplyResult =
  { ok: true; status: TicketStatus } | { ok: false; reason: 'not_found' | 'closed' | 'conflict' }

/**
 * Resposta do cliente. Se o chamado esperava por ele ou estava resolvido, volta para
 * "Em atendimento" (resolvido + resposta = o problema voltou). Fechado ou cancelado não aceita resposta.
 * Mensagem e status são gravados juntos e só se o chamado não mudou desde a leitura
 * (`updateWithMessage`); se mudou, relê uma vez.
 */
export async function addClientReply(
  clientId: string,
  code: string,
  content: string,
): Promise<ClientReplyResult> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const found = await findClientTicket(clientId, code)
    if (!found) return { ok: false, reason: 'not_found' }
    if (isTerminal(found.status)) return { ok: false, reason: 'closed' }

    const reopen = found.status === 'waiting_client' || found.status === 'resolved'
    const status: TicketStatus = reopen ? 'in_progress' : found.status
    const update = db
      .update(ticket)
      .set({
        status,
        updatedAt: new Date(),
        ...(found.status === 'resolved' ? { resolvedAt: null } : {}),
      })
      .where(unchangedSince(found))
      .returning({ id: ticket.id })
    if (await updateWithMessage(update, { authorId: clientId, content }))
      return { ok: true, status }
  }
  return { ok: false, reason: 'conflict' }
}

const isTerminal = (status: TicketStatus) =>
  (TERMINAL_TICKET_STATUSES as readonly TicketStatus[]).includes(status)

/**
 * "Já resolvi": o cliente fecha o próprio chamado dizendo que resolveu. Conta como resolvido (a data
 * de resolução fica a do técnico, se já havia). Fechado ou cancelado: 409. O UPDATE só vale para
 * chamado ainda não encerrado, então uma mudança da equipe no meio do caminho não é sobrescrita.
 */
export async function closeClientTicket(
  clientId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'closed' }> {
  const now = new Date()
  const [updated] = await db
    .update(ticket)
    .set({
      status: 'closed',
      closeReason: 'client_resolved',
      closedAt: now,
      resolvedAt: sql`coalesce(${ticket.resolvedAt}, ${now})`,
      updatedAt: now,
    })
    .where(
      and(
        eq(ticket.code, code),
        eq(ticket.clientId, clientId),
        notInArray(ticket.status, [...TERMINAL_TICKET_STATUSES]),
      ),
    )
    .returning({ id: ticket.id })
  if (updated) return { ok: true }
  return (await findClientTicket(clientId, code))
    ? { ok: false, reason: 'closed' }
    : { ok: false, reason: 'not_found' }
}

/** Resposta pública de alguém que não é o dono do chamado (nota interna não conta). */
const staffAnswered = sql`exists (
  select 1 from ${ticketMessage}
  where ${ticketMessage.ticketId} = ${ticket.id}
    and ${ticketMessage.internal} = false
    and ${ticketMessage.authorId} <> ${ticket.clientId})`

/**
 * O cliente cancela o próprio chamado enquanto ele está aberto e ninguém da equipe respondeu em
 * público (`canClientCancel`). Tudo num UPDATE só, com a regra no WHERE: se a equipe responder ao
 * mesmo tempo, o cancelamento não passa. Nada é apagado.
 */
export async function cancelClientTicket(
  clientId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'not_cancellable' }> {
  const now = new Date()
  const [updated] = await db
    .update(ticket)
    .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
    .where(
      and(
        eq(ticket.code, code),
        eq(ticket.clientId, clientId),
        eq(ticket.status, 'open'),
        sql`not ${staffAnswered}`,
      ),
    )
    .returning({ id: ticket.id })
  if (updated) return { ok: true }
  return (await findClientTicket(clientId, code))
    ? { ok: false, reason: 'not_cancellable' }
    : { ok: false, reason: 'not_found' }
}

/** Conversas do usuário com a Wen, da mais recente para a mais antiga. `search` procura no texto das mensagens. */
export async function listConversations(params: {
  userId: string
  limit: number
  offset: number
  search?: string
}) {
  // SQL escrito à mão de propósito: numa consulta de uma tabela só, o Drizzle omite o nome da tabela
  // nas colunas, e dentro destas subconsultas `"id"` passaria a ser o id da outra tabela.
  const outerId = sql.raw('"conversation"."id"')
  const firstQuestion = sql<string | null>`(
    select cm.content from conversation_message cm
    where cm.conversation_id = ${outerId} and cm.role = 'user'
    order by cm.id limit 1)`
  const messageCount = sql<number>`(
    select count(*)::int from conversation_message cm where cm.conversation_id = ${outerId})`
  const ticketCode = sql<string | null>`(
    select t.code from ticket t where t.conversation_id = ${outerId}
    order by t.number desc limit 1)`
  const lastMessage = sql<string | null>`(
    select cm.content from conversation_message cm
    where cm.conversation_id = ${outerId}
    order by cm.id desc limit 1)`

  const filters: SQL[] = [eq(conversation.userId, params.userId)]
  const term = params.search?.trim()
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    filters.push(sql`exists (
      select 1 from conversation_message cm
      where cm.conversation_id = ${outerId} and cm.content ilike ${pattern})`)
  }
  const where = and(...filters)
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: conversation.id,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        title: conversation.title,
        kind: conversation.kind,
        lastMessage,
        firstQuestion,
        messageCount,
        ticketCode,
      })
      .from(conversation)
      .where(where)
      .orderBy(desc(conversation.updatedAt))
      .limit(params.limit)
      .offset(params.offset),
    db.select({ n: count() }).from(conversation).where(where),
  ])
  return { conversations: rows, total: totalRow?.n ?? 0 }
}

/** Uma conversa do usuário com as mensagens e os chamados abertos a partir dela. */
export async function getConversation(userId: string, id: string) {
  const found = await db.query.conversation.findFirst({
    where: and(eq(conversation.id, id), eq(conversation.userId, userId)),
    columns: { id: true, title: true, kind: true, status: true, createdAt: true, updatedAt: true },
    with: {
      messages: {
        orderBy: asc(conversationMessage.id),
        columns: { role: true, content: true, source: true, createdAt: true },
        with: { ticket: { columns: { code: true, subject: true } } },
      },
      tickets: { columns: { code: true, status: true } },
    },
  })
  return found ?? null
}
