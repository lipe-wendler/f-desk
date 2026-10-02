import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createXai } from '@ai-sdk/xai'
import type { LanguageModel } from 'ai'

/**
 * Provedores aceitos em `LLM_MODEL` (`<provedor>:<modelo>`) e a variável com a chave de cada um.
 * Para trocar de modelo ou provedor basta mudar `LLM_MODEL` e cadastrar a chave correspondente.
 */
export const LLM_PROVIDERS = {
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  xai: 'XAI_API_KEY',
} as const
export type LlmProvider = keyof typeof LLM_PROVIDERS

export const DEFAULT_LLM_MODEL = 'google:gemini-3.5-flash-lite'

export interface LlmConfig {
  provider: LlmProvider
  modelId: string
  apiKey: string
}

/** Lê `provedor:modelo` e a chave do provedor. `null` quando o valor é inválido ou falta a chave. */
export function resolveLlmConfig(
  spec: string,
  keys: Partial<Record<(typeof LLM_PROVIDERS)[LlmProvider], string>>,
): LlmConfig | null {
  const separator = spec.indexOf(':')
  if (separator <= 0) return null
  const provider = spec.slice(0, separator)
  const modelId = spec.slice(separator + 1).trim()
  if (!modelId || !(provider in LLM_PROVIDERS)) return null
  const apiKey = keys[LLM_PROVIDERS[provider as LlmProvider]]
  return apiKey ? { provider: provider as LlmProvider, modelId, apiKey } : null
}

const factories: Record<LlmProvider, (apiKey: string) => (modelId: string) => LanguageModel> = {
  google: (apiKey) => createGoogleGenerativeAI({ apiKey }),
  anthropic: (apiKey) => createAnthropic({ apiKey }),
  openai: (apiKey) => createOpenAI({ apiKey }),
  xai: (apiKey) => createXai({ apiKey }),
}

/** Modelo pronto para o AI SDK, criado só com a chave do provedor escolhido. */
export function createLanguageModel({ provider, modelId, apiKey }: LlmConfig): LanguageModel {
  return factories[provider](apiKey)(modelId)
}
