import type { FaqCategory } from './faq'

/**
 * Atendimento guiado: o que o Wen diz em cada passo antes de qualquer chamada ao LLM.
 * As opções de cada categoria são as perguntas do FAQ dela; escolher uma pede ao servidor a
 * resposta pronta pelo id (`faqId`), sem custo de IA.
 */
export const GUIDED_FLOWS: Record<
  FaqCategory,
  { label: string; description: string; intro: string }
> = {
  question: {
    label: 'Tenho uma dúvida',
    description: 'Encontre respostas e orientações sobre o sistema.',
    intro: 'Sobre o que é a sua dúvida? Escolha a opção mais parecida com o seu caso.',
  },
  problem: {
    label: 'Algo não está funcionando',
    description: 'Conte o que aconteceu e receba ajuda para resolver.',
    intro: 'O que não está funcionando? Escolha o que mais parece com o seu caso.',
  },
}

/** Saída do fluxo para o texto livre (aí o LLM entra). */
export const GUIDED_OTHER = {
  label: 'Outro assunto',
  reply: 'Tudo bem. Me conte com as suas palavras o que está acontecendo.',
}

/** Pergunta depois de uma resposta pronta e o que cada lado diz em seguida. */
export const GUIDED_FEEDBACK = {
  question: 'Isso resolveu?',
  resolved: {
    label: 'Resolveu',
    reply: 'Que bom. Se precisar de mais alguma coisa, é só chamar.',
  },
  unresolved: {
    label: 'Não resolveu',
    reply:
      'Entendi. Me conte com mais detalhes o que acontece: o que você já tentou e o que aparece na tela. Se eu não conseguir resolver, preparo um chamado para a equipe técnica.',
  },
}

/** Atalhos acima do campo de digitação na conversa vazia (ids do FAQ). */
export const QUICK_SUGGESTIONS = [
  'sem-acesso-conta',
  'internet-lenta',
  'impressora',
  'email-nao-envia',
] as const
