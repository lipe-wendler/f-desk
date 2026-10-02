import { FAQ, type ChatMessage, type FaqEntry } from '@f-desk/shared'

/** Palavras que não ajudam a distinguir uma pergunta da outra. */
const STOPWORDS = new Set(
  'a o as os um uma de da do das dos em no na nos nas e ou que para pra por com sem se meu minha meus minhas eu me esta este isso esse essa ao aos como qual quais quando onde porque por que ja nao mais muito tem ter tenho estou ta to e'.split(
    ' ',
  ),
)
// "nao" é stopword para a pergunta, mas importa para "não imprime" × "imprime"; os padrões a mantêm.
STOPWORDS.delete('nao')

/** Minúsculas, sem acento, sem pontuação, sem plural simples. */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/e-mail/g, 'email')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !STOPWORDS.has(word))
    .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word))
}

/** Quanto do padrão aparece na mensagem (0 a 1). */
function coverage(pattern: string[], message: Set<string>): number {
  if (pattern.length === 0) return 0
  return pattern.filter((word) => message.has(word)).length / pattern.length
}

const index = FAQ.map((entry) => ({
  entry,
  patterns: [entry.question, ...entry.patterns].map(tokenize).filter((p) => p.length > 0),
}))

/** Acima disso a mensagem vira uma pergunta detalhada demais para resposta pronta. */
const MAX_MESSAGE_WORDS = 30
const MIN_SCORE = 0.8

export interface FaqMatch {
  entry: FaqEntry
  score: number
}

/**
 * Procura a resposta pronta mais próxima. Devolve `null` quando nenhuma cobre a mensagem
 * ou quando a mesma resposta acabou de ser dada (a pessoa voltou a perguntar: é a vez do LLM).
 */
export function matchFaq(message: string, history: ChatMessage[] = []): FaqMatch | null {
  const words = tokenize(message)
  if (words.length === 0 || words.length > MAX_MESSAGE_WORDS) return null
  const messageSet = new Set(words)

  let best: FaqMatch | null = null
  for (const { entry, patterns } of index) {
    // Empate: o padrão mais longo é o mais específico.
    for (const pattern of patterns) {
      const score = coverage(pattern, messageSet) + pattern.length / 1000
      if (!best || score > best.score) best = { entry, score }
    }
  }
  if (!best || best.score < MIN_SCORE) return null

  const lastReply = [...history].reverse().find((m) => m.role === 'assistant')
  if (lastReply?.content === best.entry.answer) return null
  return { entry: best.entry, score: Math.min(best.score, 1) }
}
