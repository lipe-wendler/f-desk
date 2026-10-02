import { describe, expect, it } from 'vitest'
import { DEFAULT_LLM_MODEL, createLanguageModel, resolveLlmConfig } from '../services/llm/models'

describe('resolveLlmConfig', () => {
  it('usa o Gemini 3.5 Flash Lite por padrão', () => {
    expect(DEFAULT_LLM_MODEL).toBe('google:gemini-3.5-flash-lite')
    expect(resolveLlmConfig(DEFAULT_LLM_MODEL, { GOOGLE_GENERATIVE_AI_API_KEY: 'k' })).toEqual({
      provider: 'google',
      modelId: 'gemini-3.5-flash-lite',
      apiKey: 'k',
    })
  })

  it('troca de provedor só pela configuração, com a chave de cada um', () => {
    const keys = { ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o', XAI_API_KEY: 'x' }
    expect(resolveLlmConfig('anthropic:claude-sonnet-5-5', keys)?.apiKey).toBe('a')
    expect(resolveLlmConfig('openai:gpt-5-mini', keys)?.apiKey).toBe('o')
    expect(resolveLlmConfig('xai:grok-4-fast', keys)?.apiKey).toBe('x')
  })

  it('desliga o LLM sem chave, com provedor desconhecido ou formato inválido', () => {
    expect(resolveLlmConfig('google:gemini-3.5-flash-lite', {})).toBeNull()
    expect(resolveLlmConfig('mistral:large', { GOOGLE_GENERATIVE_AI_API_KEY: 'k' })).toBeNull()
    expect(
      resolveLlmConfig('gemini-3.5-flash-lite', { GOOGLE_GENERATIVE_AI_API_KEY: 'k' }),
    ).toBeNull()
    expect(resolveLlmConfig('google:', { GOOGLE_GENERATIVE_AI_API_KEY: 'k' })).toBeNull()
  })

  it('cria o modelo do provedor escolhido', () => {
    const model = createLanguageModel({
      provider: 'anthropic',
      modelId: 'claude-haiku-4-5',
      apiKey: 'k',
    })
    expect(model).toMatchObject({
      provider: expect.stringContaining('anthropic'),
      modelId: 'claude-haiku-4-5',
    })
  })
})
