/** Grupos da lista de conversas, do mais recente para o mais antigo. */
export const RECENCY_GROUPS = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'week', label: 'Últimos 7 dias' },
  { id: 'month', label: 'Últimos 30 dias' },
  { id: 'older', label: 'Mais antigas' },
] as const

export type RecencyGroupId = (typeof RECENCY_GROUPS)[number]['id']

const DAY = 24 * 60 * 60 * 1000

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Em que grupo cai uma data, contando dias de calendário no fuso de quem vê. */
export function recencyOf(iso: string, now: Date): RecencyGroupId {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return 'week'
  if (days < 30) return 'month'
  return 'older'
}

/** Agrupa mantendo a ordem recebida (a API já manda da mais recente para a mais antiga). Omite grupos vazios. */
export function groupByRecency<T extends { updatedAt: string }>(items: T[], now = new Date()) {
  const buckets = new Map<RecencyGroupId, T[]>()
  for (const item of items) {
    const id = recencyOf(item.updatedAt, now)
    buckets.set(id, [...(buckets.get(id) ?? []), item])
  }
  return RECENCY_GROUPS.filter((g) => buckets.has(g.id)).map((g) => ({
    ...g,
    items: buckets.get(g.id)!,
  }))
}

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

/** "14:30" para hoje; "2 de out." para os outros dias. */
export function formatWhen(iso: string, now = new Date()) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return recencyOf(iso, now) === 'today' ? time.format(date) : shortDate.format(date)
}
