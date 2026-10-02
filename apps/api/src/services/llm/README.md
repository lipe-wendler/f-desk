# services/llm

Respostas da Wen fora do FAQ, com o [AI SDK](https://ai-sdk.dev) (`ai`), que dá a mesma interface para
vários provedores. As chaves só existem no servidor.

- `models.ts`: `LLM_MODEL` no formato `<provedor>:<modelo>` escolhe o provedor (`google`, `anthropic`,
  `openai` ou `xai`) e a chave correspondente. Padrão: `google:gemini-3.5-flash-lite`. Para um provedor
  novo, instale o pacote `@ai-sdk/<provedor>` e acrescente uma linha em `LLM_PROVIDERS` e em `factories`.
- `prompt.ts`: instruções fixas da Wen com a base de FAQ como referência. Não coloque nada que mude a cada
  pedido (data, nome do usuário) para o prefixo continuar em cache nos provedores.
- `reply.ts`: streaming da resposta (`streamText`), com as últimas 12 mensagens como contexto.
