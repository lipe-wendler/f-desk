const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

/** 02/10/2026, 14:30 */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
/** 2 de out. de 2026 */
export const formatDate = (iso: string) => date.format(new Date(iso))

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

/** Horário de uma mensagem: "14:30" se for de hoje; "01/10 14:30" se for de outro dia. */
export function formatMessageTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay ? time.format(date) : `${dayMonth.format(date)} ${time.format(date)}`
}
