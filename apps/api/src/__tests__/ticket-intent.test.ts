import { describe, expect, it } from 'vitest'
import { isTicketLookup, isTicketRequest } from '../services/faq/intent'

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

describe('pergunta sobre os próprios chamados', () => {
  it.each([
    'quais são meus chamados?',
    'Meus chamados',
    'como está o meu chamado?',
    'qual o status do meu chamado',
    'quero ver os chamados abertos',
    'tem novidade no meu ticket?',
    'como anda o TKT-0042?',
    'e o tkt 42?',
    'Como acompanho meu chamado?',
    'lista minhas solicitações',
    'não tive resposta no chamado',
  ])('"%s" é consulta de chamado', (message) => {
    expect(isTicketLookup(message)).toBe(true)
  })

  it.each([
    'Abra um chamado',
    'quero abrir um chamado',
    'quero falar com um técnico',
    'a impressora não imprime',
    'qual o status do meu pedido de compra',
    'Como abro um chamado?',
  ])('"%s" não é consulta de chamado', (message) => {
    expect(isTicketLookup(message)).toBe(false)
  })
})
