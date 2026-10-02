import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { describeConversation } from '../services/llm/meta'

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 4, text: 4, reasoning: undefined },
}

function modelReturning(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text }],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage,
      warnings: [],
    }),
  })
}

const input = { history: [], message: 'Minha conta foi bloqueada', reply: 'Vamos ver.' }

describe('título e tipo da conversa pelo LLM', () => {
  it('devolve o título limpo e o tipo', async () => {
    const model = modelReturning(
      JSON.stringify({ title: '  Conta bloqueada após troca de senha. ', kind: 'access' }),
    )
    expect(await describeConversation(model, input)).toEqual({
      title: 'Conta bloqueada após troca de senha',
      kind: 'access',
    })
    const prompt = JSON.stringify(model.doGenerateCalls[0]!.prompt)
    expect(prompt).toContain('Cliente: Minha conta foi bloqueada')
    expect(prompt).toContain('Wen: Vamos ver.')
  })

  it('tipo fora da lista ou erro do provedor viram null', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(
      await describeConversation(modelReturning('{"title":"x y","kind":"outro"}'), input),
    ).toBeNull()
    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('fora do ar')
      },
    })
    expect(await describeConversation(failing, input)).toBeNull()
    error.mockRestore()
  })
})
