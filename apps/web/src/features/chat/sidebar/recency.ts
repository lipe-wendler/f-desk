const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'always' })
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

/**
 * Tempo desde a última interação: "agora", "há 4 minutos", "há 3 horas"; a partir de um dia, a
 * data ("01/10/2026").
 */
export function formatSince(iso: string, now = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const diff = Math.max(0, now.getTime() - then.getTime())
  if (diff < MINUTE) return 'agora'
  if (diff < HOUR) return relative.format(-Math.floor(diff / MINUTE), 'minute')
  if (diff < DAY) return relative.format(-Math.floor(diff / HOUR), 'hour')
  return date.format(then)
}
