import type { ChatMessage, TicketStatus } from '@f-desk/shared'
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { db } from '../client'
import { conversation, conversationMessage, ticket, ticketMessage } from '../schema'

export interface NewTicket {
  clientId: string
  subject: string
  description: string
  /** Conversa já gravada do cliente (chat logado). Tem prioridade sobre `transcript`. */
  conversationId?: string
  /** Conversa que estava só no navegador (visitante que entrou para abrir o chamado). */
  transcript: ChatMessage[]
}

/** Abre o chamado e liga a conversa com a Wen (existente ou criada a partir da transcrição). */
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

  const insertTicket = (convId: string | null) =>
    db
      .insert(ticket)
      .values({ clientId, subject, description, conversationId: convId })
      .returning({ id: ticket.id, code: ticket.code })

  if (!linkedId && transcript.length > 0) {
    const newId = crypto.randomUUID()
    // `batch` é transacional no driver HTTP: chamado e conversa entram juntos ou nenhum entra.
    const [, , created] = await db.batch([
      db.insert(conversation).values({ id: newId, userId: clientId }),
      db
        .insert(conversationMessage)
        .values(
          transcript.map((m) => ({ conversationId: newId, role: m.role, content: m.content })),
        ),
      insertTicket(newId),
    ])
    return created[0]!
  }

  const [created] = await insertTicket(linkedId)
  return created!
}

/** Filtros da lista do cliente: em aberto (pedem ação) ou encerrados (resolvidos e fechados). */
export const TICKET_SCOPES = {
  active: ['open', 'in_progress', 'waiting_client'],
  done: ['resolved', 'closed'],
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
            columns: { role: true, content: true, source: true },
          },
        },
      },
    },
  })
  if (!found) return null
  const { assignee, messages, conversation: origin, ...rest } = found
  return {
    ...rest,
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
  { ok: true; status: TicketStatus } | { ok: false; reason: 'not_found' | 'closed' }

/**
 * Resposta do cliente. Se o chamado esperava por ele ou estava resolvido, volta para
 * "Em atendimento" (resolvido + resposta = o problema voltou). Fechado não aceita resposta.
 */
export async function addClientReply(
  clientId: string,
  code: string,
  content: string,
): Promise<ClientReplyResult> {
  const found = await findClientTicket(clientId, code)
  if (!found) return { ok: false, reason: 'not_found' }
  if (found.status === 'closed') return { ok: false, reason: 'closed' }

  const reopen = found.status === 'waiting_client' || found.status === 'resolved'
  const status: TicketStatus = reopen ? 'in_progress' : found.status
  await db.batch([
    db.insert(ticketMessage).values({ ticketId: found.id, authorId: clientId, content }),
    db
      .update(ticket)
      .set({
        status,
        updatedAt: new Date(),
        ...(found.status === 'resolved' ? { resolvedAt: null } : {}),
      })
      .where(eq(ticket.id, found.id)),
  ])
  return { ok: true, status }
}

/** O cliente encerra o próprio chamado (resolvido, ou desistiu do atendimento). */
export async function closeClientTicket(
  clientId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'closed' }> {
  const found = await findClientTicket(clientId, code)
  if (!found) return { ok: false, reason: 'not_found' }
  if (found.status === 'closed') return { ok: false, reason: 'closed' }
  const now = new Date()
  await db
    .update(ticket)
    .set({ status: 'closed', closedAt: now, updatedAt: now })
    .where(eq(ticket.id, found.id))
  return { ok: true }
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
    columns: { id: true, title: true, kind: true, createdAt: true, updatedAt: true },
    with: {
      messages: {
        orderBy: asc(conversationMessage.id),
        columns: { role: true, content: true, source: true, createdAt: true },
      },
      tickets: { columns: { code: true, status: true } },
    },
  })
  return found ?? null
}
