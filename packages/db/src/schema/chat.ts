import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Limite de mensagens do chat público, numa janela fixa por chave (`ip:<hash>` ou `user:<id>`).
 * Fica no Postgres porque as Functions da Vercel não compartilham memória. O IP é guardado como hash.
 */
export const chatRateLimit = pgTable('chat_rate_limit', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).defaultNow().notNull(),
  count: integer('count').notNull(),
})
