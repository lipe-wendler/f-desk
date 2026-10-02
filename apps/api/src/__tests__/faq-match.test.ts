import { FAQ, FAQ_CATEGORIES } from '@f-desk/shared'
import { describe, expect, it } from 'vitest'
import { matchFaq, tokenize } from '../services/faq/match'

describe('base de FAQ', () => {
  it('tem 12 respostas em cada categoria e ids únicos', () => {
    for (const category of FAQ_CATEGORIES) {
      expect(FAQ.filter((e) => e.category === category.id)).toHaveLength(12)
    }
    expect(new Set(FAQ.map((e) => e.id)).size).toBe(FAQ.length)
  })

  it('cada pergunta sugerida leva à própria resposta', () => {
    for (const entry of FAQ) expect(matchFaq(entry.question)?.entry.id).toBe(entry.id)
  })
})

describe('tokenize', () => {
  it('ignora acentos, maiúsculas, pontuação, palavras vazias e plural simples', () => {
    expect(tokenize('Não consigo abrir os ARQUIVOS!')).toEqual([
      'nao',
      'consigo',
      'abrir',
      'arquivo',
    ])
    expect(tokenize('Meu e-mail')).toEqual(['email'])
  })
})

describe('matchFaq', () => {
  it.each([
    ['minha impressora parou', 'impressora'],
    ['o computador ta muito lento hoje', 'computador-lento'],
    ['esqueci minha senha do sistema', 'sem-acesso-conta'],
    ['a internet está caindo toda hora', 'internet-lenta'],
    ['acho que cliquei num link suspeito', 'phishing'],
    ['como faço backup?', 'backup'],
  ])('"%s" → %s', (message, id) => {
    expect(matchFaq(message)?.entry.id).toBe(id)
  })

  it('não responde com FAQ quando nada cobre a mensagem', () => {
    expect(matchFaq('qual a capital da França?')).toBeNull()
    expect(matchFaq('o sistema de notas fiscais mostra erro 503 ao exportar')).toBeNull()
  })

  it('mensagens longas e detalhadas vão para o LLM', () => {
    const long = `minha impressora ${'da recepção que fica no segundo andar perto da janela '.repeat(6)}`
    expect(matchFaq(long)).toBeNull()
  })

  it('não repete a mesma resposta pronta em seguida', () => {
    const first = matchFaq('a impressora não imprime')!
    const history = [
      { role: 'user' as const, content: 'a impressora não imprime' },
      { role: 'assistant' as const, content: first.entry.answer },
    ]
    expect(matchFaq('a impressora continua sem imprimir', history)).toBeNull()
  })
})
