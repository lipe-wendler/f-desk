import {
  ACTIVE_TICKET_STATUSES,
  isTicketTerminal,
  planTicketUpdate,
  staffReplyEffects,
  STAFF_ROLES,
  type StaffQueue,
  type StaffUpdateError,
  type TicketChanges,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketInput,
} from '@f-desk/shared'
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../client'
import { conversationMessage, ticket, ticketMessage, user } from '../schema'

const client = alias(user, 'client')
const assignee = alias(user, 'assignee')

const DONE_STATUSES = ['resolved', 'closed', 'cancelled'] as const satisfies readonly TicketStatus[]

/** Urgente primeiro; dentro da mesma prioridade, o chamado mais antigo. */
const priorityRank = sql`case ${ticket.priority} when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end`

export interface StaffQueueParams {
  staffId: string
  queue: StaffQueue
  priority?: TicketPriority
  search?: string
  limit: number
  offset: number
}

/** Fila do dashboard, com cliente e responsável. */
export async function listStaffTickets(params: StaffQueueParams) {
  const filters: SQL[] = []
  const active = inArray(ticket.status, [...ACTIVE_TICKET_STATUSES])
  if (params.queue === 'active') filters.push(active)
  if (params.queue === 'mine') filters.push(active, eq(ticket.assigneeId, params.staffId))
  if (params.queue === 'unassigned') filters.push(active, isNull(ticket.assigneeId))
  if (params.queue === 'done') filters.push(inArray(ticket.status, [...DONE_STATUSES]))
  if (params.priority) filters.push(eq(ticket.priority, params.priority))
  const term = params.search?.trim()
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    filters.push(
      or(
        ilike(ticket.code, pattern),
        ilike(ticket.subject, pattern),
        ilike(client.name, pattern),
        ilike(client.email, pattern),
      )!,
    )
  }
  const where = filters.length ? and(...filters) : undefined
  const order =
    params.queue === 'done' || params.queue === 'all'
      ? [desc(ticket.updatedAt)]
      : [asc(priorityRank), asc(ticket.createdAt)]

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        code: ticket.code,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        client: { name: client.name, email: client.email },
        assignee: { id: assignee.id, name: assignee.name },
      })
      .from(ticket)
      .innerJoin(client, eq(client.id, ticket.clientId))
      .leftJoin(assignee, eq(assignee.id, ticket.assigneeId))
      .where(where)
      .orderBy(...order)
      .limit(params.limit)
      .offset(params.offset),
    db
      .select({ n: count() })
      .from(ticket)
      .innerJoin(client, eq(client.id, ticket.clientId))
      .where(where),
  ])
  return { tickets: rows, total: totalRow?.n ?? 0 }
}

/**
 * Números dos cards do dashboard, numa consulta só. "Resolvidos" conta `resolved_at`: a equipe
 * marcando como resolvido ou o cliente no "Já resolvi". Cancelado nunca tem `resolved_at` (só sai de
 * "Aberto"), então não conta.
 */
export async function getStaffMetrics(staffId: string) {
  const active = sql`${ticket.status} in ('open', 'in_progress', 'waiting_client')`
  const [row] = await db
    .select({
      open: sql<number>`count(*) filter (where ${ticket.status} = 'open')::int`,
      inProgress: sql<number>`count(*) filter (where ${ticket.status} = 'in_progress')::int`,
      waitingClient: sql<number>`count(*) filter (where ${ticket.status} = 'waiting_client')::int`,
      unassigned: sql<number>`count(*) filter (where ${active} and ${ticket.assigneeId} is null)::int`,
      mine: sql<number>`count(*) filter (where ${active} and ${ticket.assigneeId} = ${staffId})::int`,
      resolvedThisWeek: sql<number>`count(*) filter (where ${ticket.resolvedAt} >= now() - interval '7 days')::int`,
    })
    .from(ticket)
  return row!
}

/** Chamado completo para a equipe: notas internas, cliente e a conversa com a Wen. */
export async function getStaffTicket(code: string) {
  const found = await db.query.ticket.findFirst({
    where: eq(ticket.code, code),
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
      client: { columns: { name: true, email: true } },
      assignee: { columns: { id: true, name: true } },
      messages: {
        orderBy: asc(ticketMessage.id),
        columns: { id: true, content: true, internal: true, createdAt: true },
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
  const { conversation: origin, assignee: owner, ...rest } = found
  return { ...rest, assignee: owner ?? null, transcript: origin?.messages ?? [] }
}

async function findTicketState(code: string) {
  const [row] = await db
    .select({ id: ticket.id, status: ticket.status, assigneeId: ticket.assigneeId })
    .from(ticket)
    .where(eq(ticket.code, code))
    .limit(1)
  return row ?? null
}

const toColumns = (changes: TicketChanges) => {
  const now = new Date()
  return {
    ...(changes.status ? { status: changes.status } : {}),
    ...(changes.priority ? { priority: changes.priority } : {}),
    ...(changes.assigneeId !== undefined ? { assigneeId: changes.assigneeId } : {}),
    ...(changes.resolvedAt !== undefined ? { resolvedAt: changes.resolvedAt ? now : null } : {}),
    ...(changes.closedAt ? { closedAt: now } : {}),
    ...(changes.closeReason ? { closeReason: changes.closeReason } : {}),
    updatedAt: now,
  }
}

export type StaffReplyResult =
  | { ok: true; status: TicketStatus; assigneeId: string | null }
  | { ok: false; reason: 'not_found' | 'closed' }

/**
 * Resposta pública ou nota interna da equipe. Nota interna não mexe em status nem na data de
 * atualização. Chamado fechado ou cancelado só aceita leitura.
 */
export async function addStaffReply(
  staffId: string,
  code: string,
  content: string,
  internal: boolean,
): Promise<StaffReplyResult> {
  const found = await findTicketState(code)
  if (!found) return { ok: false, reason: 'not_found' }
  if (isTicketTerminal(found.status)) return { ok: false, reason: 'closed' }

  const effects = staffReplyEffects(found, staffId, internal)
  const insert = db
    .insert(ticketMessage)
    .values({ ticketId: found.id, authorId: staffId, content, internal })
  if (internal) await insert
  else {
    await db.batch([
      insert,
      db.update(ticket).set(toColumns(effects)).where(eq(ticket.id, found.id)),
    ])
  }
  return {
    ok: true,
    status: effects.status ?? found.status,
    assigneeId: effects.assigneeId !== undefined ? effects.assigneeId : found.assigneeId,
  }
}

/** Técnicos e admins ativos, para atribuir chamados. */
export async function listAssignees() {
  return db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(
      and(inArray(user.role, [...STAFF_ROLES]), or(eq(user.banned, false), isNull(user.banned))),
    )
    .orderBy(asc(user.name))
}

export type StaffUpdateResult =
  { ok: true } | { ok: false; reason: 'not_found' } | { ok: false; reason: StaffUpdateError }

/** Status, prioridade e responsável. As regras ficam em `planTicketUpdate` (`@f-desk/shared`). */
export async function updateStaffTicket(
  code: string,
  input: UpdateTicketInput,
): Promise<StaffUpdateResult> {
  const found = await findTicketState(code)
  if (!found) return { ok: false, reason: 'not_found' }
  const plan = planTicketUpdate(found, input)
  if (!plan.ok) return { ok: false, reason: plan.error }

  if (plan.changes.assigneeId) {
    const valid = (await listAssignees()).some((a) => a.id === plan.changes.assigneeId)
    if (!valid) return { ok: false, reason: 'INVALID_ASSIGNEE' }
  }
  await db.update(ticket).set(toColumns(plan.changes)).where(eq(ticket.id, found.id))
  return { ok: true }
}
