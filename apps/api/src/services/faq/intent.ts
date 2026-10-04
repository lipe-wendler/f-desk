/** Minúsculas e sem acento, para comparar o pedido com os padrões abaixo. */
function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Pergunta sobre como funciona ("como abro um chamado?"): a resposta pronta explica. */
const HOW_TO = /^\s*(como|onde|de que jeito)\b/
/** Quer ver um chamado que já existe, não abrir outro. */
const TRACKING = /\b(ver|veja|acompanh\w*|status|andamento|situacao)\b/
const REQUEST = [
  // "abra um chamado", "quero abrir um ticket", "pode registrar um chamado pra mim"
  /\b(abr\w*|cri\w*|registr\w*|ger\w*|faz\w*|quero|preciso|gostaria)\b.*\b(chamado|ticket)s?\b/,
  /\b(chamado|ticket)s?\b.*\b(abr\w*|registr\w*)\b/,
  // "falar com um técnico", "quero um atendente", "atendimento humano"
  /\bfalar com (um |uma |o |a |algum |alguem )?(tecnico|atendente|pessoa|humano|suporte|alguem)\b/,
  /\b(quero|preciso|chama\w*) (de |o |a )?(um |uma )?(tecnico|atendente|pessoa|humano)\b/,
  /\batendimento humano\b/,
]

/**
 * A pessoa está pedindo um chamado (ou alguém da equipe). Nesse caso a resposta pronta "como abrir
 * um chamado" não serve: o Wen prepara o chamado ou pergunta o que está acontecendo.
 */
export function isTicketRequest(message: string): boolean {
  const text = normalize(message)
  if (HOW_TO.test(text) || TRACKING.test(text)) return false
  return REQUEST.some((pattern) => pattern.test(text))
}

/** Resposta pronta "Como acompanho meu chamado?": para o cliente logado, a Wen lista os chamados. */
export const TRACKING_FAQ_ID = 'acompanhar-chamado'

const TICKET_WORD = String.raw`(chamados?|tickets?|solicitac(ao|oes))`
const LOOKUP = [
  // "meus chamados", "minhas solicitações", "meu chamado", "o meu ticket"
  new RegExp(String.raw`\b(meus|minhas?|meu) ${TICKET_WORD}\b`),
  // "status do chamado", "andamento dos chamados", "quais chamados", "listar os tickets"
  new RegExp(
    String.raw`\b(status|andamento|situacao|acompanh\w*|ver|veja|mostr\w*|list\w*|quais|novidades?|resposta)\b.*\b${TICKET_WORD}\b`,
  ),
  // "chamados abertos", "chamado em andamento"
  new RegExp(
    String.raw`\b${TICKET_WORD} (abertos?|em aberto|em andamento|pendentes?|encerrados?)\b`,
  ),
  // um código: "TKT-0042", "tkt 42"
  /\btkt[\s-]?\d+\b/,
]

/**
 * A pessoa quer saber dos chamados dela ("quais são meus chamados?", "como está o TKT-0042?",
 * "status do meu chamado"). Para o cliente logado com a Wen, isso vai às ferramentas de chamados em
 * vez da resposta pronta que manda abrir "Meus chamados". Pedido de chamado novo não conta.
 */
export function isTicketLookup(message: string): boolean {
  const text = normalize(message)
  if (isTicketRequest(message)) return false
  return LOOKUP.some((pattern) => pattern.test(text))
}
