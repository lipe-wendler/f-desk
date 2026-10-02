import { describe, expect, it } from 'vitest'
import { safeRedirect } from '../redirect'

describe('safeRedirect', () => {
  it('aceita caminhos internos', () => {
    expect(safeRedirect('/chamados/novo')).toBe('/chamados/novo')
    expect(safeRedirect('/chamados?status=open#topo')).toBe('/chamados?status=open#topo')
    expect(safeRedirect(['/conversas'])).toBe('/conversas')
  })

  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    'chamados',
    '',
    null,
    undefined,
    42,
  ])('recusa %s', (value) => {
    expect(safeRedirect(value)).toBeNull()
  })
})
