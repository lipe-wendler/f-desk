import type { RequestKind } from '@f-desk/shared'
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
  /** Título e tipo dados pelo bot. Só preenchem a conversa que ainda não tem (a primeira troca vale). */
  meta?: { title: string; kind: RequestKind | null }
}

/**
 * Grava a pergunta e a resposta do chat de um usuário logado (num `batch`, que é transacional
 * no driver HTTP). Devolve o id da conversa.
 */
export async function saveChatExchange({
  conversationId,
  userId,
  question,
  reply,
  meta,
}: ChatExchange) {
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
    await db.batch([
      db
        .insert(conversation)
        .values({ id: targetId, userId, title: meta?.title ?? null, kind: meta?.kind ?? null }),
      messages,
    ])
  } else {
    await db.batch([
      messages,
      db
        .update(conversation)
        .set({
          updatedAt: new Date(),
          // Mensagem nova reabre a conversa que estava marcada como resolvida.
          status: 'open',
          ...(meta && {
            title: sql`coalesce(${conversation.title}, ${meta.title})`,
            kind: sql`coalesce(${conversation.kind}, ${meta.kind})`,
          }),
        })
        .where(eq(conversation.id, targetId)),
    ])
  }
  return targetId
}

export interface ConversationFeedback {
  conversationId: string
  userId: string
  resolved: boolean
  /** O que o cliente respondeu ("Resolveu" / "Não resolveu") e a resposta do Wen. */
  answer: string
  reply: string
}

/**
 * Grava o "Resolveu" / "Não resolveu" como mensagens da conversa e atualiza o status. Devolve
 * false se a conversa não existe ou é de outra pessoa.
 */
export async function saveConversationFeedback({
  conversationId,
  userId,
  resolved,
  answer,
  reply,
}: ConversationFeedback) {
  const [own] = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(and(eq(conversation.id, conversationId), eq(conversation.userId, userId)))
    .limit(1)
  if (!own) return false
  await db.batch([
    db.insert(conversationMessage).values([
      { conversationId, role: 'user' as const, content: answer },
      { conversationId, role: 'assistant' as const, content: reply, source: null },
    ]),
    db
      .update(conversation)
      .set({ updatedAt: new Date(), status: resolved ? 'resolved' : 'open' })
      .where(eq(conversation.id, conversationId)),
  ])
  return true
}
