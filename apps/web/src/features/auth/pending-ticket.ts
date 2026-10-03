import type { LocationQuery } from 'vue-router'

/**
 * Valor de `?motivo=` que o cartão do chamado manda para o cadastro e o login. O mesmo
 * `redirect=/atendimento` também sai da sidebar do atendimento, então só ele não diz que há um
 * chamado esperando.
 */
export const PENDING_TICKET_REASON = 'chamado'

/** Veio do cartão do chamado e volta para o atendimento: mostra a faixa "Falta pouco…". */
export function isPendingTicket(query: LocationQuery, redirect: string | null): boolean {
  return redirect === '/atendimento' && query.motivo === PENDING_TICKET_REASON
}
