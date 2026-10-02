import type { IconName } from '@f-desk/ui'

/**
 * Textos da landing page num lugar só (revisar a copy sem abrir componente).
 * `*palavra*` vira destaque amarelo (`fw-hl`) nos títulos. Voz da marca: frases curtas,
 * verbo nos botões, sem exclamação e sem números inventados.
 */

export type Billing = 'monthly' | 'yearly'

export interface Plan {
  id: 'lite' | 'pro' | 'enterprise'
  name: string
  description: string
  /** Preço em reais por mês no plano mensal. 0 = grátis. */
  monthly: number
  features: string[]
  cta: string
  to: string
  featured?: boolean
}

/** No anual, 12 meses pelo preço de 10. */
export const YEARLY_MONTHS = 10

export const landing = {
  nav: [
    { id: 'como-funciona', label: 'Como funciona' },
    { id: 'recursos', label: 'Recursos' },
    { id: 'planos', label: 'Planos' },
    { id: 'duvidas', label: 'Dúvidas' },
  ],
  hero: {
    eyebrow: 'Atendimento · Chamados · IA',
    manifesto: ['Entender a dúvida.', 'Conectar quem resolve.', 'Resolver *de verdade.*'],
    summary:
      'O F.Desk junta um assistente com IA e a sua equipe técnica num lugar só. O Wen responde o que é comum na hora e, quando não resolve, abre o chamado com a conversa inteira para o técnico.',
    primary: 'Falar com o Wen',
    secondary: 'Ver planos',
    previewLabel:
      'Exemplo de conversa: o cliente conta o problema, o Wen tenta resolver e abre o chamado TKT-0042.',
  },
  words: ['Entender', 'Conectar', 'Resolver', 'Evoluir'],
  proof: {
    title: 'O F.Desk em números',
    items: [
      { value: '24h', label: 'de atendimento. O Wen responde a qualquer hora, sem fila.' },
      { value: '0', label: 'formulários. O Wen escreve o título e a descrição do chamado.' },
      { value: '1', label: 'conversa só. O cliente conta o caso uma vez e ele segue junto.' },
      { value: '3', label: 'perfis de acesso: cliente, técnico e admin.' },
    ],
  },
  beforeAfter: {
    eyebrow: 'Antes e depois',
    title: 'O que muda com o *F.Desk*',
    lead: 'Três problemas comuns no suporte e como o F.Desk resolve cada um.',
    labels: { problem: 'Problema', solution: 'Solução', result: 'Resultado' },
    items: [
      {
        title: 'Pedidos espalhados',
        problem: 'Pedidos chegam por e-mail, WhatsApp e telefone, e alguns se perdem.',
        solution: 'Uma entrada só: o Wen recebe tudo e organiza em chamados.',
        result: 'Nenhum pedido fica sem dono.',
      },
      {
        title: 'Cliente repetindo o caso',
        problem: 'A cada contato, o cliente explica tudo de novo.',
        solution: 'A conversa com o Wen vai junto com o chamado.',
        result: 'O cliente conta uma vez só.',
      },
      {
        title: 'Técnico sem contexto',
        problem: 'O técnico começa do zero, perguntando o básico.',
        solution: 'Título, descrição e histórico chegam prontos no painel.',
        result: 'O atendimento começa pela solução.',
      },
    ],
  },
  howItWorks: {
    eyebrow: 'Como funciona',
    title: 'Do primeiro contato ao chamado *resolvido*',
    lead: 'Um caminho simples, igual para todo cliente.',
    steps: [
      {
        title: 'Entender',
        text: 'O Wen pergunta o que aconteceu, com opções prontas para os casos comuns.',
      },
      {
        title: 'Responder',
        text: 'Dúvidas frequentes têm resposta na hora. O resto vai para a IA.',
      },
      {
        title: 'Escalar',
        text: 'Se não resolver, o Wen escreve o chamado e você só confirma.',
      },
      {
        title: 'Atender',
        text: 'O técnico recebe o caso com a conversa inteira e responde pelo painel.',
      },
      {
        title: 'Melhorar',
        text: 'O histórico mostra o que mais aparece, para virar resposta pronta.',
      },
    ],
  },
  features: {
    eyebrow: 'Recursos',
    title: 'O que vem no *F.Desk*',
    lead: 'Tudo o que o atendimento precisa, do primeiro contato ao fechamento.',
    items: [
      {
        icon: 'message',
        title: 'Atendimento com IA',
        description:
          'O Wen responde em português claro, a qualquer hora, e sabe quando chamar uma pessoa.',
        tags: ['Respostas prontas', 'Fluxos guiados', 'IA'],
      },
      {
        icon: 'inbox',
        title: 'Chamado sem formulário',
        description:
          'O chamado nasce da conversa: título, descrição e histórico preenchidos pelo Wen.',
        tags: ['Abertura pelo chat', 'Histórico', 'Status'],
      },
      {
        icon: 'bar-chart',
        title: 'Painel do técnico',
        description: 'Fila por status e prioridade, números do dia e resposta direto no chamado.',
        tags: ['Prioridade', 'Notas internas', 'Métricas'],
      },
      {
        icon: 'shield',
        title: 'Acesso sob controle',
        description: 'Perfis de cliente, técnico e admin, com as regras checadas no servidor.',
        tags: ['Perfis', 'Gestão de usuários', 'Sessões'],
      },
    ] satisfies { icon: IconName; title: string; description: string; tags: string[] }[],
  },
  audience: {
    eyebrow: 'Para quem',
    title: 'Cada um no seu *lugar*',
    lead: 'O mesmo sistema, com a tela certa para cada perfil.',
    items: [
      {
        icon: 'user',
        title: 'Cliente',
        text: 'Tira dúvidas a qualquer hora, abre chamado sem formulário e acompanha tudo numa tela.',
      },
      {
        icon: 'gear',
        title: 'Técnico',
        text: 'Recebe o caso com contexto, responde pelo painel e deixa notas internas para a equipe.',
      },
      {
        icon: 'users',
        title: 'Admin',
        text: 'Cria os técnicos, define os perfis e acompanha a operação.',
      },
    ] satisfies { icon: IconName; title: string; text: string }[],
  },
  pricing: {
    eyebrow: 'Planos',
    title: 'Escolha o plano *certo*',
    lead: 'Comece grátis e mude de plano quando a equipe crescer.',
    billingLabel: 'Cobrança',
    monthly: 'Mensal',
    yearly: 'Anual',
    yearlyBadge: '2 meses grátis',
    featuredBadge: 'Mais escolhido',
    free: 'Grátis',
    perMonth: '/mês',
    perYear: '/ano',
    plans: [
      {
        id: 'lite',
        name: 'Lite',
        description: 'Para organizar o atendimento desde o primeiro dia.',
        monthly: 0,
        features: [
          'Wen com respostas prontas',
          'Fluxos guiados por categoria',
          '1 técnico',
          'Histórico de 30 dias',
        ],
        cta: 'Começar grátis',
        to: '/criar-conta',
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'Para equipes que querem a IA resolvendo e abrindo chamados.',
        monthly: 149,
        features: [
          'Tudo do Lite',
          'IA para os casos novos',
          'Chamado aberto pelo Wen',
          'Até 5 técnicos',
          'Histórico sem limite',
        ],
        cta: 'Assinar o Pro',
        to: '/criar-conta?plano=pro',
        featured: true,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Para operações maiores, com prioridade e acompanhamento.',
        monthly: 449,
        features: [
          'Tudo do Pro',
          'Técnicos sem limite',
          'Prioridade e prazo por cliente',
          'Gestão avançada de usuários',
          'Suporte dedicado',
        ],
        cta: 'Assinar o Enterprise',
        to: '/criar-conta?plano=enterprise',
      },
    ] satisfies Plan[],
  },
  quote: {
    text: 'Boas soluções nascem entre pessoas, negócio e tecnologia.',
    by: 'F.Wendler',
  },
  faq: {
    eyebrow: 'Dúvidas',
    title: 'Perguntas *frequentes*',
    items: [
      {
        question: 'Preciso criar conta para usar o Wen?',
        answer:
          'Não. Qualquer pessoa conversa com o Wen sem cadastro. A conta só é pedida para abrir e acompanhar chamados.',
      },
      {
        question: 'O Wen substitui a equipe técnica?',
        answer:
          'Não. Ele resolve o que é comum e organiza o resto. Quando o caso pede uma pessoa, o Wen abre o chamado e um técnico assume.',
      },
      {
        question: 'Como o chamado é aberto?',
        answer:
          'Pela própria conversa. Se o Wen não resolver, ele propõe um título e uma descrição, e você confirma com um clique.',
      },
      {
        question: 'Preciso de cartão para começar?',
        answer: 'Não. O Lite é grátis e não pede cartão. Você muda de plano quando quiser.',
      },
      {
        question: 'Posso trocar de plano depois?',
        answer: 'Sim, a qualquer momento. No anual, você paga 10 meses e usa 12.',
      },
    ],
  },
  finalCta: {
    title: 'Tem um problema? O Wen *resolve.*',
    lead: 'Comece agora, sem cadastro: o atendimento é aberto para visitantes.',
    primary: 'Falar com o Wen',
    secondary: 'Criar conta',
  },
  footer: {
    tagline: 'Soluções para problemas reais.',
    rights: 'Todos os direitos reservados.',
  },
}
