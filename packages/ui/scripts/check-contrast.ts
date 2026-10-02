// Confere o contraste WCAG dos pares de tokens em todos os temas.
// Texto: 4.5:1. Contornos de controle, foco e ícones: 3:1.
import { loadTokens, resolveColor } from './tokens.ts'

const TEXT = 4.5
const UI = 3

/** [frente, fundos, mínimo] */
const PAIRS: [string, string[], number][] = [
  ['ink', ['bg', 'surface', 'surface-raised', 'field'], TEXT],
  ['ink-muted', ['bg', 'surface', 'surface-raised', 'field'], TEXT],
  ['accent-text', ['bg', 'surface', 'accent-soft'], TEXT],
  ['on-accent', ['accent', 'accent-hover'], TEXT],
  ['success', ['bg', 'surface'], TEXT],
  ['danger', ['bg', 'surface', 'field'], TEXT],
  ['on-danger', ['danger'], TEXT],
  ['line-strong', ['bg', 'surface', 'surface-raised', 'field'], UI],
  ['focus', ['bg', 'surface', 'surface-raised'], UI],
]

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`Cor não suportada pelo verificador: ${hex}`)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const file = loadTokens()
let failures = 0
for (const { id } of file.color.themes) {
  console.log(`\nTema ${id}`)
  for (const [fg, bgs, min] of PAIRS) {
    for (const bg of bgs) {
      const ratio = contrast(resolveColor(file, fg, id), resolveColor(file, bg, id))
      const ok = ratio >= min
      if (!ok) failures++
      console.log(`  ${ok ? '✓' : '✖'} ${fg} sobre ${bg}: ${ratio.toFixed(2)}:1 (mín. ${min})`)
    }
  }
}

if (failures) {
  console.error(`\n✖ ${failures} par(es) abaixo do mínimo`)
  process.exit(1)
}
console.log('\n✓ Todos os pares passam')
