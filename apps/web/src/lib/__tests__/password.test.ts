import { describe, expect, it } from 'vitest'
import { initialsOf } from '../initials'
import { generatePassword } from '../password'

describe('generatePassword', () => {
  it('gera senhas com tamanho mínimo, sem caracteres ambíguos e com os três tipos', () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword()
      expect(p).toHaveLength(14)
      expect(p).not.toMatch(/[0O1lI]/)
      expect(p).toMatch(/[a-z]/)
      expect(p).toMatch(/[A-Z]/)
      expect(p).toMatch(/[2-9]/)
    }
  })

  it('respeita o mínimo do better-auth e não repete', () => {
    expect(generatePassword(4)).toHaveLength(8)
    expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50)
  })
})

describe('initialsOf', () => {
  it('usa até duas iniciais', () => {
    expect(initialsOf('Ana Souza Lima')).toBe('AS')
    expect(initialsOf('  felipe ')).toBe('F')
    expect(initialsOf('')).toBe('')
  })
})
