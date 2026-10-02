# services/faq

Primeiro nível do atendimento: a mensagem é comparada com a base de respostas prontas antes de ir
para o LLM.

- A base fica em `packages/shared/src/faq.ts` (duas categorias, "Tenho uma dúvida" e "Algo não está
  funcionando"), porque o web também mostra as perguntas como sugestões.
- `match.ts` compara sem acento, sem maiúsculas, sem palavras vazias e sem plural simples. Cada resposta
  tem `patterns`; a mensagem precisa cobrir pelo menos 80% de algum deles.
- Mensagens longas (mais de 30 palavras úteis) e a repetição da mesma resposta logo em seguida vão para
  o LLM: a resposta pronta não resolveu.
