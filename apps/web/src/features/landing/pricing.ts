import { YEARLY_MONTHS, type Billing, type Plan } from './landing-content'

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

/** Valor cobrado no período escolhido (o anual cobra `YEARLY_MONTHS` meses). */
export function planPrice(plan: Plan, billing: Billing): number {
  return billing === 'yearly' ? plan.monthly * YEARLY_MONTHS : plan.monthly
}

export function formatBRL(value: number): string {
  // O Intl usa espaço não separável entre "R$" e o número; troca por espaço comum para o texto ficar previsível.
  return brl.format(value).replace(/\s/g, ' ')
}

/** Quanto o anual sai por mês, arredondado para baixo. */
export function yearlyPerMonth(plan: Plan): number {
  return Math.floor((plan.monthly * YEARLY_MONTHS) / 12)
}
