// Gera src/styles/tokens.css a partir de src/tokens/tokens.json.
// Uso: `node scripts/build-tokens.ts` (escreve) ou `node scripts/build-tokens.ts --check` (falha se desatualizado).
import { readFileSync, writeFileSync } from 'node:fs'
import { cssColor, loadTokens, scalarFamilies, valueFor } from './tokens.ts'

const OUT = new URL('../src/styles/tokens.css', import.meta.url)
const file = loadTokens()
const [defaultTheme, ...otherThemes] = file.color.themes
if (!defaultTheme) throw new Error('tokens.json sem temas')

const lines: string[] = [
  '/* Gerado por scripts/build-tokens.ts a partir de src/tokens/tokens.json — não edite à mão. */',
  '',
]

function block(selector: string, theme: string, withScalars: boolean) {
  lines.push(`${selector} {`)
  lines.push(`  color-scheme: ${theme === 'light' ? 'light' : 'dark'};`)
  // Fora do tema padrão, só entram os tokens que mudam por tema.
  const colors = withScalars
    ? file.color.tokens
    : file.color.tokens.filter((t) => typeof t.value !== 'string')
  for (const token of colors) lines.push(`  --${token.name}: ${cssColor(file, token, theme)};`)
  for (const [, family] of scalarFamilies(file)) {
    const themed = family.tokens.filter((t) => typeof t.value !== 'string')
    const list = withScalars ? family.tokens : themed
    for (const token of list)
      lines.push(`  --${token.name}: ${valueFor(token, theme, defaultTheme!.id)};`)
  }
  if (withScalars) {
    for (const [role, stack] of Object.entries(file.type.families))
      lines.push(`  --font-${role}: ${stack};`)
  }
  lines.push('}', '')
}

block(`:root,\n[data-theme='${defaultTheme.id}']`, defaultTheme.id, true)
for (const theme of otherThemes) block(`[data-theme='${theme.id}']`, theme.id, false)

const css = lines.join('\n')
if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8')
  if (current !== css) {
    console.error(
      '✖ src/styles/tokens.css está desatualizado. Rode `pnpm --filter @f-desk/ui tokens`.',
    )
    process.exit(1)
  }
  console.log('✓ tokens.css em dia com tokens.json')
} else {
  writeFileSync(OUT, css)
  console.log('✓ src/styles/tokens.css gerado')
}
