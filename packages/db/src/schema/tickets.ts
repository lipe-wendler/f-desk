// Chamados e conversas do chatbot. Status, prioridades e papéis vêm de `@f-desk/shared`,
// e os checks do banco usam as mesmas listas.
import {
  CHAT_ROLES,
  CHAT_SOURCES,
  CONVERSATION_STATUSES,
  DEFAULT_TICKET_PRIORITY,
  DEFAULT_TICKET_STATUS,
  REQUEST_KIND_IDS,
  TICKET_CLOSE_REASONS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '@f-desk/shared'
import { relations, sql, type AnyColumn } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

/** Check `coluna IN (...)` com os valores fixos de `@f-desk/shared` (constantes, nunca entrada do usuário). */
const oneOf = (column: AnyColumn, values: readonly string[]) =>
  sql`${column} in (${sql.raw(values.map((value) => `'${value}'`).join(', '))})`

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull()

/**
 * Conversa com o chatbot. `user_id` nulo: visitante sem conta (a conversa fica só no navegador até virar chamado).
 * `title` e `kind` são definidos pelo bot na primeira troca gravada: a pergunta do FAQ ou o resumo do LLM.
 * `status` vira `resolved` quando o cliente responde "Resolveu" e volta a `open` na mensagem seguinte.
 */
export const conversation = pgTable(
  'conversation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    title: text('title'),
    kind: text('kind', { enum: REQUEST_KIND_IDS }),
    status: text('status', { enum: CONVERSATION_STATUSES }).default('open').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('conversation_user_id_updated_at_idx').on(table.userId, table.updatedAt.desc()),
    check('conversation_kind_check', oneOf(table.kind, REQUEST_KIND_IDS)),
    check('conversation_status_check', oneOf(table.status, CONVERSATION_STATUSES)),
  ],
)

/**
 * Mensagem da conversa. O `id` sequencial define a ordem: a transcrição importada entra num único
 * INSERT e todas as linhas ficam com o mesmo `created_at`.
 * `source` só existe nas respostas do assistente (nulo quando a origem é desconhecida, como na
 * transcrição que vem do navegador, ou quando a fala registra um chamado aberto).
 */
export const conversationMessage = pgTable(
  'conversation_message',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    role: text('role', { enum: CHAT_ROLES }).notNull(),
    content: text('content').notNull(),
    source: text('source', { enum: CHAT_SOURCES }),
    /** Fala do Wen que registra o chamado aberto pela conversa (o cartão do chamado aparece nela). */
    ticketId: uuid('ticket_id').references((): AnyPgColumn => ticket.id, { onDelete: 'set null' }),
    /**
     * Veio da transcrição do navegador (conversa de visitante), não de uma troca gravada pela API.
     * O texto não é verificado: uma fala "da Wen" aqui pode ter sido escrita pelo próprio cliente.
     */
    imported: boolean('imported').default(false).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('conversation_message_conversation_id_idx').on(table.conversationId, table.id),
    check('conversation_message_role_check', oneOf(table.role, CHAT_ROLES)),
    check(
      'conversation_message_source_check',
      sql`${table.source} is null or (${table.role} = 'assistant' and ${oneOf(table.source, CHAT_SOURCES)})`,
    ),
  ],
)

/**
 * Chamado. `number` vem de uma sequência do banco e `code` (`TKT-0001`) é gerado a partir dele,
 * então a numeração não depende de transação na aplicação (o driver HTTP não tem transação interativa).
 * Contas não são apagadas (são desativadas), e o `restrict` em `client_id` garante o histórico.
 * Nada é apagado: cancelar é um status final (`cancelled`), como fechar.
 */
export const ticket = pgTable(
  'ticket',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: integer('number').notNull().unique().generatedAlwaysAsIdentity(),
    code: text('code')
      .notNull()
      .unique()
      .generatedAlwaysAs(
        sql`'TKT-' || lpad("number"::text, greatest(4, length("number"::text)), '0')`,
      ),
    clientId: text('client_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    assigneeId: text('assignee_id').references(() => user.id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    description: text('description').notNull(),
    status: text('status', { enum: TICKET_STATUSES }).notNull().default(DEFAULT_TICKET_STATUS),
    priority: text('priority', { enum: TICKET_PRIORITIES })
      .notNull()
      .default(DEFAULT_TICKET_PRIORITY),
    /** Conversa com o chatbot que originou o chamado (transcrição anexada na abertura). */
    conversationId: uuid('conversation_id').references(() => conversation.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** Cancelado pelo cliente (status `cancelled`). */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /** Quem fechou e por quê (`TICKET_CLOSE_REASONS`); nulo nos fechados antes da tarefa 18. */
    closeReason: text('close_reason', { enum: TICKET_CLOSE_REASONS }),
  },
  (table) => [
    index('ticket_client_id_created_at_idx').on(table.clientId, table.createdAt.desc()),
    index('ticket_assignee_id_status_idx').on(table.assigneeId, table.status),
    index('ticket_status_priority_created_at_idx').on(
      table.status,
      table.priority,
      table.createdAt,
    ),
    check('ticket_status_check', oneOf(table.status, TICKET_STATUSES)),
    check('ticket_priority_check', oneOf(table.priority, TICKET_PRIORITIES)),
    check('ticket_close_reason_check', oneOf(table.closeReason, TICKET_CLOSE_REASONS)),
  ],
)

/** Mensagem do chamado. `internal`: nota só da equipe, nunca enviada ao cliente. Ordem pelo `id`. */
export const ticketMessage = pgTable(
  'ticket_message',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => ticket.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    content: text('content').notNull(),
    internal: boolean('internal').default(false).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('ticket_message_ticket_id_idx').on(table.ticketId, table.id)],
)

export const conversationRelations = relations(conversation, ({ one, many }) => ({
  user: one(user, { fields: [conversation.userId], references: [user.id] }),
  messages: many(conversationMessage),
  tickets: many(ticket),
}))

export const conversationMessageRelations = relations(conversationMessage, ({ one }) => ({
  conversation: one(conversation, {
    fields: [conversationMessage.conversationId],
    references: [conversation.id],
  }),
  ticket: one(ticket, { fields: [conversationMessage.ticketId], references: [ticket.id] }),
}))

export const ticketRelations = relations(ticket, ({ one, many }) => ({
  client: one(user, { fields: [ticket.clientId], references: [user.id] }),
  assignee: one(user, { fields: [ticket.assigneeId], references: [user.id] }),
  conversation: one(conversation, {
    fields: [ticket.conversationId],
    references: [conversation.id],
  }),
  messages: many(ticketMessage),
}))

export const ticketMessageRelations = relations(ticketMessage, ({ one }) => ({
  ticket: one(ticket, { fields: [ticketMessage.ticketId], references: [ticket.id] }),
  author: one(user, { fields: [ticketMessage.authorId], references: [user.id] }),
}))
