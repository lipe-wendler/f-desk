/**
 * Tipo de solicitação de uma conversa, mostrado como selo na lista do atendimento. Vem do FAQ
 * (cada resposta pronta tem um tipo) ou do LLM, que classifica a conversa nova.
 */
export const REQUEST_KINDS = [
  { id: 'access', label: 'Acesso', tone: 'red' },
  { id: 'data', label: 'Dados', tone: 'blue' },
  { id: 'integration', label: 'Integração', tone: 'purple' },
  { id: 'question', label: 'Dúvida', tone: 'green' },
  { id: 'bug', label: 'Bug', tone: 'orange' },
  { id: 'feature', label: 'Feature', tone: 'pink' },
] as const

export type RequestKind = (typeof REQUEST_KINDS)[number]['id']
export const REQUEST_KIND_IDS = REQUEST_KINDS.map((k) => k.id) as [RequestKind, ...RequestKind[]]

export function isRequestKind(value: unknown): value is RequestKind {
  return typeof value === 'string' && (REQUEST_KIND_IDS as string[]).includes(value)
}

/** Tamanho máximo do título da conversa (gerado pelo bot). */
export const CONVERSATION_TITLE_MAX = 80

/** Título de reserva: a primeira mensagem, cortada sem partir palavra. */
export function fallbackTitle(message: string): string {
  const text = message.replace(/\s+/g, ' ').trim()
  if (text.length <= 60) return text
  const cut = text.slice(0, 60)
  const space = cut.lastIndexOf(' ')
  return `${(space > 30 ? cut.slice(0, space) : cut).trimEnd()}…`
}
