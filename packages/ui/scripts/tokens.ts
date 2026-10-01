// Leitura do tokens.json (formato do design system F.Wendler) e resolução de aliases `{token}`.
import { readFileSync } from 'node:fs'

export type ThemeId = string
type Value = string | Record<ThemeId, string>
interface Token {
  name: string
  value: Value
  usage?: string
}
interface Family {
  tokens: Token[]
}
interface FontFace {
  family: string
  file: string
  weight: string
  style?: string
}
export interface TokensFile {
  name: string
  color: { themes: { id: ThemeId; name: string }[]; tokens: Token[] }
  type: { fonts: FontFace[]; families: Record<string, string> }
  [family: string]: unknown
}

export const TOKENS_PATH = new URL('../src/tokens/tokens.json', import.meta.url)

export function loadTokens(): TokensFile {
  return JSON.parse(readFileSync(TOKENS_PATH, 'utf8')) as TokensFile
}

/** Famílias com o formato `{ tokens: [...] }`, exceto `color` e `type`. */
export function scalarFamilies(file: TokensFile): [string, Family][] {
  return Object.entries(file)
    .filter(([key, v]) => key !== 'color' && key !== 'type' && isFamily(v))
    .map(([key, v]) => [key, v as Family])
}

function isFamily(v: unknown): v is Family {
  return typeof v === 'object' && v !== null && Array.isArray((v as Family).tokens)
}

/** Valor de um token num tema; tokens sem valor no tema herdam o do primeiro tema. */
export function valueFor(token: Token, theme: ThemeId, firstTheme: ThemeId): string {
  if (typeof token.value === 'string') return token.value
  return token.value[theme] ?? token.value[firstTheme] ?? ''
}

/** Resolve uma cor (seguindo aliases) para o seu valor literal num tema. */
export function resolveColor(
  file: TokensFile,
  name: string,
  theme: ThemeId,
  seen: string[] = [],
): string {
  const [first] = file.color.themes
  const token = file.color.tokens.find((t) => t.name === name)
  if (!token || !first) throw new Error(`Token de cor inexistente: ${name}`)
  const raw = valueFor(token, theme, first.id)
  const alias = /^\{(.+)\}$/.exec(raw)?.[1]
  if (!alias) return raw
  if (seen.includes(alias)) throw new Error(`Alias circular: ${[...seen, alias].join(' → ')}`)
  return resolveColor(file, alias, theme, [...seen, name])
}

/** Valor CSS de uma cor num tema: aliases viram `var(--alias)`. */
export function cssColor(file: TokensFile, token: Token, theme: ThemeId): string {
  const [first] = file.color.themes
  const raw = valueFor(token, theme, first!.id)
  const alias = /^\{(.+)\}$/.exec(raw)?.[1]
  return alias ? `var(--${alias})` : raw
}
