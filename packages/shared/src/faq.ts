import type { RequestKind } from './request-kind'

/**
 * Base de respostas prontas da Wen (primeiro nível do atendimento).
 * A API compara a mensagem com `patterns`; o web mostra `question` como sugestão por categoria.
 * Para editar: mantenha as respostas curtas, em passos, sem prometer prazo nem preço.
 */
export const FAQ_CATEGORIES = [
  { id: 'question', label: 'Tenho uma dúvida' },
  { id: 'problem', label: 'Algo não está funcionando' },
] as const
export type FaqCategory = (typeof FAQ_CATEGORIES)[number]['id']

export interface FaqEntry {
  id: string
  category: FaqCategory
  /** Tipo de solicitação da conversa que começa por esta resposta (selo na lista de conversas). */
  kind: RequestKind
  /** Pergunta exibida como sugestão. */
  question: string
  /** Frases e palavras-chave que levam a esta resposta (comparadas sem acento e sem maiúsculas). */
  patterns: string[]
  answer: string
}

const TICKET_HINT = 'Se não resolver, me conte aqui que eu preparo um chamado para um técnico.'

export const FAQ: FaqEntry[] = [
  // Tenho uma dúvida
  {
    id: 'abrir-chamado',
    category: 'question',
    kind: 'question',
    question: 'Como abro um chamado?',
    patterns: [
      'abrir chamado',
      'abrir um chamado',
      'abrir ticket',
      'falar com tecnico',
      'atendimento humano',
      'falar com uma pessoa',
    ],
    answer:
      'Conte aqui na conversa o que está acontecendo: o que aconteceu, quando começou e o que você já tentou. Eu tento resolver primeiro; se não der, preparo um chamado com o que você contou, e você só confere e confirma. Para abrir é preciso estar logado (criar a conta leva menos de um minuto). A conversa vai junto com o chamado.',
  },
  {
    id: 'acompanhar-chamado',
    category: 'question',
    kind: 'question',
    question: 'Como acompanho meu chamado?',
    patterns: [
      'acompanhar chamado',
      'status do chamado',
      'andamento do chamado',
      'meu chamado',
      'resposta do tecnico',
    ],
    answer:
      'Entre na sua conta e abra "Meus chamados". Lá aparecem o status de cada chamado, as respostas do técnico e o histórico completo. Quando o técnico pedir alguma informação, o chamado fica como "Aguardando cliente" até você responder.',
  },
  {
    id: 'criar-conta',
    category: 'question',
    kind: 'access',
    question: 'Preciso de uma conta para ser atendido?',
    patterns: ['criar conta', 'preciso de conta', 'cadastro', 'cadastrar', 'sem conta'],
    answer:
      'Para tirar dúvidas comigo, não. Para abrir um chamado com um técnico, sim: crie a conta em "Criar conta" com nome, e-mail e senha. Assim você acompanha o atendimento e guarda o histórico das conversas.',
  },
  {
    id: 'senha-forte',
    category: 'question',
    kind: 'access',
    question: 'Como crio uma senha segura?',
    patterns: ['senha segura', 'senha forte', 'criar senha', 'boa senha', 'gerenciador de senhas'],
    answer:
      'Use uma frase longa, com 12 caracteres ou mais, e uma senha diferente para cada serviço. Um gerenciador de senhas (como Bitwarden ou 1Password) cria e guarda tudo por você. Nunca envie sua senha por e-mail, mensagem ou chat, nem para mim.',
  },
  {
    id: 'verificacao-duas-etapas',
    category: 'question',
    kind: 'access',
    question: 'O que é verificação em duas etapas?',
    patterns: [
      'verificacao em duas etapas',
      'duas etapas',
      'autenticacao de dois fatores',
      '2fa',
      'mfa',
      'autenticador',
    ],
    answer:
      'É uma segunda confirmação além da senha, geralmente um código de um app autenticador ou SMS. Mesmo que alguém descubra sua senha, não entra sem esse código. Ative nas configurações de segurança de cada serviço e guarde os códigos de recuperação em lugar seguro.',
  },
  {
    id: 'email-celular',
    category: 'question',
    kind: 'integration',
    question: 'Como configuro meu e-mail no celular?',
    patterns: [
      'configurar email no celular',
      'email no celular',
      'email no iphone',
      'email no android',
      'adicionar conta de email',
    ],
    answer:
      '1. Instale o app do seu provedor (Outlook ou Gmail) ou use o app de e-mail do celular.\n2. Escolha "Adicionar conta" e informe seu e-mail.\n3. Siga o login do provedor, incluindo a verificação em duas etapas, se houver.\nSe pedir servidor e porta, peça esses dados ao responsável pelo seu e-mail. ' +
      TICKET_HINT,
  },
  {
    id: 'backup',
    category: 'question',
    kind: 'data',
    question: 'Como faço backup dos meus arquivos?',
    patterns: ['backup', 'copia de seguranca', 'salvar arquivos', 'onedrive', 'google drive'],
    answer:
      'Guarde os arquivos importantes numa pasta sincronizada com a nuvem (OneDrive, Google Drive ou iCloud) e confira se a sincronização está ativa. Para um cuidado extra, faça também uma cópia num HD externo de tempos em tempos. Teste de vez em quando se consegue abrir um arquivo da cópia.',
  },
  {
    id: 'phishing',
    category: 'question',
    kind: 'question',
    question: 'Recebi um e-mail suspeito. O que faço?',
    patterns: [
      'email suspeito',
      'phishing',
      'golpe',
      'link suspeito',
      'mensagem suspeita',
      'fraude',
    ],
    answer:
      'Não clique em links, não abra anexos e não responda. Desconfie de urgência, pedidos de senha, código ou pagamento e remetentes parecidos com os verdadeiros. Marque como spam ou phishing. Se você já clicou ou informou algum dado, troque a senha na hora e me avise aqui que eu preparo um chamado.',
  },
  {
    id: 'compartilhar-arquivos',
    category: 'question',
    kind: 'data',
    question: 'Como envio um arquivo grande?',
    patterns: [
      'arquivo grande',
      'enviar arquivo',
      'compartilhar arquivo',
      'anexo grande',
      'mandar arquivo',
    ],
    answer:
      'Em vez de anexar, envie um link: coloque o arquivo no OneDrive, Google Drive ou Dropbox, use "Compartilhar" e escolha quem pode acessar. A maioria dos e-mails recusa anexos acima de 20 a 25 MB.',
  },
  {
    id: 'atualizacoes',
    category: 'question',
    kind: 'question',
    question: 'Preciso instalar as atualizações do sistema?',
    patterns: [
      'atualizacoes',
      'atualizar sistema',
      'windows update',
      'atualizar o windows',
      'atualizar o mac',
    ],
    answer:
      'Sim. As atualizações corrigem falhas de segurança e problemas conhecidos. Salve o que estiver aberto, instale e reinicie quando o sistema pedir. Se uma atualização travar ou falhar mais de uma vez, me avise aqui que eu preparo um chamado.',
  },
  {
    id: 'instalar-programa',
    category: 'question',
    kind: 'question',
    question: 'Posso instalar qualquer programa?',
    patterns: ['instalar programa', 'instalar software', 'baixar programa', 'instalar aplicativo'],
    answer:
      'Baixe só do site oficial do fabricante ou da loja de apps do sistema. Evite versões "crackeadas": costumam trazer vírus e não têm licença. Se o computador for da empresa e pedir senha de administrador, me avise aqui que eu preparo um chamado para a instalação.',
  },
  {
    id: 'dados-chamado',
    category: 'question',
    kind: 'question',
    question: 'Que informações ajudam o técnico?',
    patterns: [
      'informacoes para o tecnico',
      'o que informar',
      'detalhes do problema',
      'print da tela',
      'captura de tela',
    ],
    answer:
      'Conte o que aconteceu e quando começou, a mensagem de erro exata (um print ajuda muito), em qual aparelho e programa, se acontece sempre ou às vezes, e o que você já tentou. Nunca informe sua senha.',
  },

  // Algo não está funcionando
  {
    id: 'sem-acesso-conta',
    category: 'problem',
    kind: 'access',
    question: 'Não consigo entrar na minha conta',
    patterns: [
      'nao consigo entrar',
      'nao consigo acessar',
      'esqueci minha senha',
      'esqueci a senha',
      'redefinir senha',
      'senha incorreta',
      'conta bloqueada',
    ],
    answer:
      '1. Confira se o e-mail está certo e se o Caps Lock está desligado.\n2. Use a opção "Esqueci minha senha" do serviço, se houver.\n3. Se a conta foi bloqueada por tentativas, espere alguns minutos antes de tentar de novo.\nNo F.Desk, a recuperação de senha por e-mail ainda não está disponível: um admin da equipe de suporte pode redefinir a sua senha. Peça pelo canal de contato que você já usa com a F.Wendler.',
  },
  {
    id: 'email-nao-envia',
    category: 'problem',
    kind: 'bug',
    question: 'Meu e-mail não envia ou não recebe',
    patterns: [
      'email nao envia',
      'email nao chega',
      'nao recebo email',
      'nao consigo enviar email',
      'caixa de saida',
      'caixa cheia',
    ],
    answer:
      '1. Confira a internet e abra o e-mail pelo navegador (webmail) para ver se o problema é só no app.\n2. Veja as pastas Spam e Lixo eletrônico.\n3. Confira se a caixa está cheia e apague mensagens grandes.\n4. Mensagens presas na caixa de saída costumam ser anexos grandes: remova o anexo e envie um link. ' +
      TICKET_HINT,
  },
  {
    id: 'internet-lenta',
    category: 'problem',
    kind: 'bug',
    question: 'A internet está lenta ou caindo',
    patterns: [
      'internet lenta',
      'internet caindo',
      'sem internet',
      'internet nao funciona',
      'wifi',
      'wi-fi',
      'rede caiu',
      'sem conexao',
    ],
    answer:
      '1. Veja se outros aparelhos também estão sem internet.\n2. Desligue o roteador da tomada, espere 30 segundos e ligue de novo.\n3. Chegue mais perto do roteador ou use cabo, se puder.\n4. Desligue e ligue o Wi-Fi do computador.\nSe só um aparelho estiver com problema depois disso, me avise aqui que eu preparo um chamado.',
  },
  {
    id: 'computador-lento',
    category: 'problem',
    kind: 'bug',
    question: 'Meu computador está lento',
    patterns: [
      'computador lento',
      'notebook lento',
      'pc lento',
      'computador travando',
      'muito lento',
      'demora para abrir',
    ],
    answer:
      '1. Reinicie o computador (reiniciar, não só fechar a tampa).\n2. Feche programas e abas do navegador que não está usando.\n3. Confira se há atualizações pendentes e instale.\n4. Veja se o disco está quase cheio e libere espaço.\nSe continuar lento mesmo assim, me avise aqui que eu preparo um chamado.',
  },
  {
    id: 'impressora',
    category: 'problem',
    kind: 'bug',
    question: 'A impressora não imprime',
    patterns: ['impressora', 'nao imprime', 'fila de impressao', 'papel preso'],
    answer:
      '1. Confira se a impressora está ligada, com papel, tinta ou toner e sem papel preso.\n2. Veja se ela está na mesma rede (ou com o cabo conectado).\n3. Cancele os trabalhos parados na fila de impressão.\n4. Desligue e ligue a impressora e tente de novo. ' +
      TICKET_HINT,
  },
  {
    id: 'programa-nao-abre',
    category: 'problem',
    kind: 'bug',
    question: 'Um programa não abre ou fecha sozinho',
    patterns: [
      'programa nao abre',
      'aplicativo nao abre',
      'fecha sozinho',
      'programa travou',
      'app travando',
      'nao responde',
    ],
    answer:
      '1. Feche o programa completamente e abra de novo.\n2. Reinicie o computador.\n3. Instale as atualizações do programa e do sistema.\n4. Anote a mensagem de erro exata, se aparecer. ' +
      TICKET_HINT,
  },
  {
    id: 'tela-azul',
    category: 'problem',
    kind: 'bug',
    question: 'O computador desliga sozinho ou mostra tela azul',
    patterns: [
      'tela azul',
      'desliga sozinho',
      'reinicia sozinho',
      'nao liga',
      'computador nao liga',
      'tela preta',
    ],
    answer:
      'Salve o que puder e tire uma foto da mensagem na tela. Se o computador não liga, confira o carregador e a tomada. Se ele desliga ou reinicia sozinho com frequência, pare de usar para tarefas importantes e me avise aqui que eu preparo um chamado: pode ser hardware ou aquecimento.',
  },
  {
    id: 'audio-video-reuniao',
    category: 'problem',
    kind: 'integration',
    question: 'Microfone ou câmera não funcionam na reunião',
    patterns: [
      'microfone',
      'camera',
      'nao me escutam',
      'nao escuto',
      'teams',
      'zoom',
      'google meet',
    ],
    answer:
      '1. Confira se o microfone ou a câmera não estão mutados no app e no aparelho.\n2. Nas configurações da reunião, escolha o dispositivo certo de áudio e vídeo.\n3. Veja se o navegador ou o app têm permissão para usar câmera e microfone.\n4. Feche outros apps que possam estar usando a câmera e entre de novo na reunião. ' +
      TICKET_HINT,
  },
  {
    id: 'vpn',
    category: 'problem',
    kind: 'access',
    question: 'A VPN não conecta',
    patterns: ['vpn', 'vpn nao conecta', 'acesso remoto', 'rede da empresa'],
    answer:
      '1. Confira se a internet funciona sem a VPN.\n2. Feche o app da VPN e abra de novo.\n3. Confira usuário, senha e o código da verificação em duas etapas.\n4. Reinicie o computador. ' +
      TICKET_HINT,
  },
  {
    id: 'arquivo-nao-abre',
    category: 'problem',
    kind: 'data',
    question: 'Um arquivo não abre',
    patterns: [
      'arquivo nao abre',
      'arquivo corrompido',
      'nao consigo abrir o arquivo',
      'formato nao suportado',
      'pdf nao abre',
    ],
    answer:
      '1. Confira a extensão do arquivo e se você tem um programa que abre esse formato.\n2. Baixe o arquivo de novo: o download pode ter falhado.\n3. Tente abrir em outro programa ou pelo navegador.\nNão abra arquivos inesperados de remetentes desconhecidos. ' +
      TICKET_HINT,
  },
  {
    id: 'celular-sincronizacao',
    category: 'problem',
    kind: 'integration',
    question: 'Meu celular não sincroniza e-mail ou arquivos',
    patterns: [
      'celular nao sincroniza',
      'sincronizacao',
      'nao sincroniza',
      'onedrive nao sincroniza',
      'contatos sumiram',
      'agenda nao atualiza',
    ],
    answer:
      '1. Confira a internet do celular e se a economia de bateria ou de dados não está bloqueando o app.\n2. Abra o app e puxe a tela para atualizar.\n3. Saia da conta no app e entre de novo.\n4. Atualize o app pela loja. ' +
      TICKET_HINT,
  },
  {
    id: 'virus',
    category: 'problem',
    kind: 'bug',
    question: 'Acho que meu computador está com vírus',
    patterns: [
      'virus',
      'malware',
      'hackeado',
      'invadido',
      'propaganda estranha',
      'janelas abrindo',
      'ransomware',
    ],
    answer:
      '1. Desconecte o computador da internet.\n2. Não digite senhas nesse computador.\n3. Rode uma verificação completa com o antivírus (no Windows, a Segurança do Windows).\n4. Troque as senhas importantes usando outro aparelho.\nAbra um chamado logo em seguida, principalmente se arquivos sumiram ou foram bloqueados.',
  },
]

export function findFaq(id: string): FaqEntry | undefined {
  return FAQ.find((entry) => entry.id === id)
}
