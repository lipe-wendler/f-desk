const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

/** 02/10/2026, 14:30 */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
/** 2 de out. de 2026 */
export const formatDate = (iso: string) => date.format(new Date(iso))
