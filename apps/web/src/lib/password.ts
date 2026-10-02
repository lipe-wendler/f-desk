import { PASSWORD_MIN } from '@f-desk/shared'

// Sem caracteres ambíguos (0/O, 1/l/I) para a senha poder ser ditada ou digitada sem erro.
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const ALL = LOWER + UPPER + DIGITS

function pick(alphabet: string): string {
  // Amostragem por rejeição: evita viés do módulo.
  const limit = 256 - (256 % alphabet.length)
  const buf = new Uint8Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0]! >= limit)
  return alphabet[buf[0]! % alphabet.length]!
}

/** Senha inicial aleatória (para contas criadas pelo admin), com minúscula, maiúscula e dígito. */
export function generatePassword(length = 14): string {
  const size = Math.max(length, PASSWORD_MIN)
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)]
  while (chars.length < size) chars.push(pick(ALL))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32) * (i + 1))
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}
