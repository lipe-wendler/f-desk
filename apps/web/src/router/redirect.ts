/**
 * Aceita só caminhos internos para o `?redirect=` do login. Qualquer outra coisa (URL absoluta,
 * `//host`, `/\host`, esquema) vira `null`, evitando redirecionamento para fora do F.Desk.
 */
export function safeRedirect(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || value.length > 512) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  try {
    const url = new URL(value, 'https://f-desk.local')
    if (url.origin !== 'https://f-desk.local') return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}
