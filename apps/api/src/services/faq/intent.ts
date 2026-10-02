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
