import { and, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { chatRateLimit, conversation, conversationMessage } from '../schema'

/**
 * Conta mais uma mensagem para `key` numa janela fixa de `windowSeconds` (uma única query atômica).
 * Devolve quantas mensagens a janela atual já tem e quando ela termina.
 */
export async function consumeChatQuota(key: string, windowSeconds: number) {
  const expired = sql`${chatRateLimit.windowStart} < now() - make_interval(secs => ${windowSeconds})`
  const [row] = await db
    .insert(chatRateLimit)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: chatRateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${chatRateLimit.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${chatRateLimit.windowStart} end`,
      },
    })
    .returning({ count: chatRateLimit.count, windowStart: chatRateLimit.windowStart })
  const windowStart = row?.windowStart ?? new Date()
  return {
    count: row?.count ?? 1,
    resetAt: new Date(windowStart.getTime() + windowSeconds * 1000),
  }
}

export interface ChatExchange {
  /** Conversa existente do usuário; se não existir ou for de outra pessoa, uma nova é criada. */
  conversationId?: string
  userId: string
  question: string
  reply: { content: string; source: 'faq' | 'llm' | null }
}

/**
 * Grava a pergunta e a resposta do chat de um usuário logado (num `batch`, que é transacional
 * no driver HTTP). Devolve o id da conversa.
 */
export async function saveChatExchange({ conversationId, userId, question, reply }: ChatExchange) {
  let id = conversationId
  if (id) {
    const [own] = await db
      .select({ id: conversation.id })
      .from(conversation)
      .where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
      .limit(1)
    if (!own) id = undefined
  }

  const isNew = !id
  const targetId = id ?? crypto.randomUUID()
  const messages = db.insert(conversationMessage).values([
    { conversationId: targetId, role: 'user' as const, content: question },
    {
      conversationId: targetId,
      role: 'assistant' as const,
      content: reply.content,
      source: reply.source,
    },
  ])

  if (isNew) {
    await db.batch([db.insert(conversation).values({ id: targetId, userId }), messages])
  } else {
    await db.batch([
      messages,
      db.update(conversation).set({ updatedAt: new Date() }).where(eq(conversation.id, targetId)),
    ])
  }
  return targetId
}
