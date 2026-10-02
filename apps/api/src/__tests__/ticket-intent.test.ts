import { describe, expect, it } from 'vitest'
import { isTicketRequest } from '../services/faq/intent'

describe('pedido de chamado', () => {
  it.each([
    'Abra um chamado',
    'abre um chamado pra mim',
    'quero abrir um chamado',
    'Preciso de um chamado para isso',
    'pode registrar um ticket?',
    'quero falar com um técnico',
    'Falar com uma pessoa',
    'preciso de um atendente',
    'atendimento humano, por favor',
  ])('"%s" é pedido de chamado', (message) => {
    expect(isTicketRequest(message)).toBe(true)
  })

  it.each([
    'Como abro um chamado?',
    'onde vejo meu chamado',
    'qual o status do meu chamado',
    'quero acompanhar o chamado TKT-0004',
    'a impressora não imprime',
    'meu e-mail não envia',
  ])('"%s" não é pedido de chamado', (message) => {
    expect(isTicketRequest(message)).toBe(false)
  })
})
