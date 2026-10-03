import { TERMINAL_TICKET_STATUSES, type TicketStatus } from '@f-desk/shared'
import { and, eq, notInArray, sql, type SQL } from 'drizzle-orm'
import { db } from '../client'
import { ticket, ticketMessage } from '../schema'

/** Quantas vezes uma escrita relê o chamado quando ele mudou entre a leitura e a gravação. */
export const WRITE_ATTEMPTS = 2

/** O chamado ainda está como foi lido: mesmo status e mesmo responsável. */
export function unchangedSince(state: {
  id: string
  status: TicketStatus
  assigneeId?: string | null
}) {
  return and(
    eq(ticket.id, state.id),
    eq(ticket.status, state.status),
    ...(state.assigneeId !== undefined
      ? [sql`${ticket.assigneeId} is not distinct from ${state.assigneeId}`]
      : []),
  )!
}

/**
 * Atualiza o chamado e grava a mensagem num comando só (`WITH upd AS (UPDATE … RETURNING id)
 * INSERT … SELECT FROM upd`). O UPDATE vem com a condição do estado lido (`unchangedSince`): se o
 * chamado mudou nesse meio-tempo (cancelado, fechado, outra resposta), nada é gravado e a função
 * devolve false para quem chamou reler e decidir de novo. Sem isso, uma resposta da equipe gravada
 * logo depois de um cancelamento desfazia o status final.
 */
export async function updateWithMessage(
  update: { getSQL(): SQL },
  message: { authorId: string; content: string; internal?: boolean },
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    with upd as (${update.getSQL()})
    insert into ${ticketMessage} (ticket_id, author_id, content, internal)
    select id, ${message.authorId}, ${message.content}, ${message.internal ?? false} from upd
    returning id`)
  return rows.length > 0
}

/** Nota interna: grava só se o chamado não estiver fechado ou cancelado, sem mexer nele. */
export async function insertNoteIfOpen(ticketId: string, authorId: string, content: string) {
  const { rows } = await db.execute(sql`
    insert into ${ticketMessage} (ticket_id, author_id, content, internal)
    select ${ticket.id}, ${authorId}, ${content}, true from ${ticket}
    where ${and(eq(ticket.id, ticketId), notInArray(ticket.status, [...TERMINAL_TICKET_STATUSES]))}
    returning id`)
  return rows.length > 0
}
