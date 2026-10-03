# Arquitetura

```
Navegador ──► Vercel (mesmo domínio)
               ├─ /*      → apps/web (SPA Vue estático)
               └─ /api/*  → api/index.js → apps/api (Hono) ──► Neon Postgres (Drizzle, driver HTTP)
                                                └──────────► LLM do chat (AI SDK: Gemini, Claude, OpenAI ou Grok)
```

- **Mesmo domínio para site e API** (rewrite na Vercel, proxy do Vite em dev): o cookie de sessão do
  better-auth é first-party, sem CORS nem `SameSite=None`.
- **Auth self-hosted** com better-auth em `/api/auth/*`: e-mail/senha + plugin `admin`.
  - Telas `/entrar` e `/criar-conta` validam com os schemas de `@f-desk/shared` (`signInSchema`,
    `signUpSchema`) e voltam para o `?redirect=` só se ele for um caminho interno (`safeRedirect`).
  - Sign-up público cria sempre `client` (`defaultRole`; o campo `role` é recusado no cadastro).
  - Técnicos e admins são criados por um admin (`admin.createUser`); o primeiro admin vem do
    script `pnpm --filter api seed:admin`.
  - Permissões em `apps/api/src/auth/permissions.ts`; a API confere o perfil com `requireRole`, e o
    web só espelha isso nos guards do router (`apps/web/src/router/access.ts`).
  - O perfil `admin` tem só o que a gestão de usuários usa: criar, listar, trocar perfil, redefinir
    senha, desativar/reativar e encerrar sessões. Sem personificar nem apagar contas (contas são
    desativadas para preservar o histórico de chamados).
  - Regras extras no hook `before` do better-auth (`apps/api/src/auth/admin-guard.ts`, lógica em
    `checkAdminChange` de `@f-desk/shared`): ninguém altera o próprio perfil nem se desativa, a
    plataforma nunca fica sem admin ativo e só perfis válidos são aceitos.
  - `/admin/usuarios`: a lista vem de `GET /api/admin/users` (busca sem diferenciar maiúsculas em nome
    e e-mail, filtro por perfil, paginação); as alterações usam `/api/auth/admin/*`. Sem provedor de
    e-mail ainda, a senha inicial é gerada na tela e o admin a repassa por um canal seguro.
- **Chat com a Wen** (`POST /api/chat`, público):
  1. A mensagem passa primeiro pela base de FAQ (`packages/shared/src/faq.ts`, busca em
     `apps/api/src/services/faq`). Se uma resposta pronta cobre a pergunta, ela volta na hora.
  2. Fora do FAQ, o LLM responde (`services/llm`, AI SDK). O modelo vem de `LLM_MODEL`
     (`<provedor>:<modelo>`, padrão `google:gemini-3.5-flash-lite`; provedores `google`, `anthropic`,
     `openai` e `xai`). Sem a chave do provedor, o chat avisa para abrir um chamado.
  3. A resposta chega em NDJSON (`ChatEvent` de `@f-desk/shared`), para o texto aparecer enquanto é gerado.
  - **Atendimento guiado** (`packages/shared/src/guided-flow.ts`): na tela inicial, "Tenho uma dúvida" e
    "Algo não está funcionando" mostram as perguntas do FAQ da categoria. A opção escolhida vai para a API
    com `faqId`, e a resposta sai direto daquela entrada, sem LLM e sem a busca por palavras. Os passos de
    condução (categoria, pergunta "Isso resolveu?") ficam só no navegador e não vão para o LLM. Não há
    atalho direto para a equipe: todo caso passa pelo Wen primeiro.
  - **"Resolveu" / "Não resolveu"** viram mensagens da conversa (`POST /api/conversations/:id/feedback`,
    com os textos de `GUIDED_FEEDBACK`) e mudam `conversation.status` (`open` → `resolved`). Uma mensagem
    nova reabre a conversa. "Outro assunto" e "Não resolveu" levam ao texto livre, e aí o LLM entra.
  - `GET /api/chat/status` diz se o LLM está ligado (selo "Wen disponível" ou "Só respostas prontas").
  - **Visitante:** a conversa fica só no navegador (`localStorage`). **Logado:** a API também grava
    pergunta e resposta em `conversation`/`conversation_message`, com a origem (`faq`/`llm`).
  - **Título e tipo da conversa** (lista do atendimento), definidos na primeira troca gravada:
    - resposta pronta: a pergunta do FAQ e o `kind` da entrada;
    - LLM: uma chamada curta extra (`services/llm/meta.ts`, até 4 s), só na conversa nova, pede título e
      tipo (`access`, `data`, `integration`, `question`, `bug`, `feature`);
    - sem nada disso (ou se a chamada falhar), a primeira mensagem cortada.
  - **Chamado pelo Wen:** não há botão nem formulário de abrir chamado; todo chamado nasce da conversa.
    - LLM: o modelo tem a ferramenta `proporChamado` (sem `execute`, em `services/llm/reply.ts`). Ele a
      chama quando não resolve, em caso de risco (hardware, perda de dados, invasão, acesso de admin) ou
      quando a pessoa pede um técnico, e escreve assunto e descrição (`ticketProposalSchema`, os limites
      do chamado). A rota repassa como o evento `{ type: 'ticket-proposal', subject, description }`, antes
      do `end`. Se o modelo só chamar a ferramenta, o Wen fala `CHAT_PROPOSAL_REPLY`.
    - Sem LLM e sem resposta pronta: a proposta sai de `proposalFromMessages` (a primeira fala do cliente
      vira o assunto; tudo o que ele contou, a descrição).
    - **Pedido direto** ("abra um chamado", "quero falar com um técnico", em `services/faq/intent.ts`)
      não cai na resposta pronta "Como abro um chamado?". Com LLM, a mensagem vai com uma nota pedindo a
      proposta (ou uma pergunta, se o problema ainda não foi contado). Sem LLM, a proposta sai do que o
      cliente já contou; se ele não contou nada, o Wen pergunta antes. O prompt proíbe mandar a pessoa
      entrar na conta ou ir a "Meus chamados" para abrir o chamado.
    - **Nada é aberto sem o cliente:** a proposta pendente fica num box fixo acima do campo de mensagem,
      com assunto e descrição, "Abrir chamado", "Ajustar" (edição no próprio box) e "Agora não". Só a
      proposta mais nova fica à espera. Aberta ou descartada, ela vira um registro na conversa e o foco
      volta ao campo. Confirmar chama `POST /api/tickets`,
      que confere o perfil. A sessão é conferida de novo quando a proposta chega (a tela carrega a sessão
      uma vez, e ela pode ter acabado em outra aba); enquanto isso, o box não mostra ação.
    - **Visitante:** "Crie sua conta para abrirmos o chamado. Sua conversa com a Wen fica guardada.", com
      "Criar conta" (principal) e "Já tenho conta". Os links levam `?redirect=/atendimento&motivo=chamado`:
      o cadastro e o login mostram a faixa "Falta pouco para abrir seu chamado" (só com o `motivo`, porque
      a sidebar também manda `redirect=/atendimento`) e voltam para o atendimento, onde a proposta
      continua à espera (fica no `localStorage` com a conversa).
    - **No login,** a conversa do visitante vira uma conversa da conta (`POST /api/conversations/import`)
      antes de qualquer outra coisa: aparece na sidebar, o contexto do chat passa a vir do banco e "Abrir
      chamado" usa o `conversationId`, sem reenviar a transcrição. Se a importação falhar, a conversa
      continua parcial: o chamado leva a transcrição, como antes, e a importação é tentada de novo na
      próxima carga.
    - **Equipe logada:** "Você está com uma conta da equipe; chamados são abertos por clientes."
    - Depois de aberto, o cabeçalho passa a "Chamado TKT-xxxx" e a API grava na conversa a fala do Wen
      que registra o chamado (`ticketCreatedReply`), ligada a ele por `conversation_message.ticket_id`.
      O cartão com o código e o link aparece sob essa fala, inclusive ao reabrir a conversa; o LLM vê a
      fala e não propõe outro chamado. A proposta pendente ou descartada fica só no navegador.
  - **Limite:** 20 mensagens a cada 10 minutos por conta ou por IP, contado no Postgres
    (`chat_rate_limit`; serverless não compartilha memória). O IP é guardado como hash.
  - **Contexto:** logado, o histórico que vai ao LLM vem só do banco: com `conversationId`, o gravado
    (`getConversationHistory`), ou nenhum se a conversa não for dele; sem `conversationId`, nenhum. O
    `history` enviado só vale para o visitante (afeta só a conversa dele). Quem entrou no meio da
    conversa tem o começo importado no login.

- **Chamados do cliente** (`/api/tickets`, só `client`, só os próprios; de outra pessoa a resposta é 404):
  - `POST /` abre o chamado (só pela proposta do Wen no atendimento). A conversa com a Wen vai junto: a
    gravada (`conversationId`) quando ela está completa no servidor, ou a transcrição do navegador
    (visitante que entrou para abrir o chamado), que vira uma conversa nova com as mensagens marcadas
    como `imported` (a equipe vê o aviso de trecho não verificado). Tudo num `batch` transacional. Devolve o código e o id da conversa ligada, que passa a ser a do atendimento.
  - `GET /` (filtro `active`/`done`/`all`), `GET /:code` (mensagens sem as notas internas e a conversa de
    origem), `POST /:code/messages` e `POST /:code/close`.
  - Resposta do cliente em `waiting_client` ou `resolved` volta o chamado para `in_progress`; `closed` só
    aceita leitura (409). O código `TKT-0001` é o identificador na URL.
- **Conversas do cliente** (`/api/conversations`, só `client`): lista com título, tipo, última mensagem,
  primeira pergunta e o último chamado ligado (`q` busca no texto das mensagens, paginada por `page`/`pageSize`), e o detalhe com as
  mensagens. No atendimento, a sidebar lista as conversas por recência e `/atendimento/:conversa` abre
  uma delas.
  - `POST /import` recebe a transcrição do navegador (o mesmo schema da transcrição do chamado, de 1 a
    100 mensagens) e cria a conversa com o `user_id` da sessão e as mensagens marcadas como `imported`,
    num `batch`. Conta na cota `client-write` e tem uma própria, `conversation-import`, com o mesmo
    limite de abrir chamado (5 por hora), porque grava o mesmo volume; aceita corpo de até 2 MB.

- **Dashboard da equipe** (`/api/staff`, só `technician` e `admin`):
  - `GET /metrics` (cards), `GET /assignees` (técnicos e admins ativos), `GET /tickets` (filas `active`,
    `mine`, `unassigned`, `done`, `all`, filtro de prioridade e busca por código, assunto, nome ou e-mail;
    nas filas em aberto, urgente primeiro e, dentro da prioridade, o mais antigo).
  - `GET /tickets/:code` (com notas internas e dados do cliente), `POST /tickets/:code/messages`
    (resposta ou nota interna) e `PATCH /tickets/:code` (status, prioridade, responsável).
  - Regras em `packages/shared/src/staff.ts`: transições de `TICKET_STATUS_TRANSITIONS`, chamado fechado
    não muda, só técnico ou admin ativo pode ser responsável, e as datas de resolução e fechamento são
    gravadas na mudança. A primeira resposta pública num chamado aberto o coloca em atendimento e, sem
    responsável, atribui a quem respondeu. Nota interna não muda status nem a data de atualização.
- **Contexto da Wen:** a mensagem atual vai com uma nota dizendo se a pessoa está logada (as instruções
  fixas não mudam, para o prefixo continuar em cache).

## Modelo de dados

Schema em `packages/db/src/schema`; status, prioridades e papéis das mensagens vêm de
`packages/shared/src/tickets.ts`, e os checks do banco usam as mesmas listas.

Migrations em `packages/db/drizzle`, aplicadas à mão em cada branch do Neon (`pnpm db:migrate`). O
build da Vercel nunca aplica, só confere: se o banco do deploy não tem alguma migration do código, o build
falha (em produção, a versão anterior continua no ar). Fluxo em [deploy.md](deploy.md#a-cada-mudança-no-banco-migrations).

- **Auth** (`auth.ts`, gerado pelo better-auth): `user` (com `role`, `banned`…), `session`, `account`,
  `verification`, `rate_limit`.
- **Limite do chat** (`chat.ts`): `chat_rate_limit` (key, window_start, count), janela fixa por chave.
- **Chamados e conversas** (`tickets.ts`):

| Tabela                 | Campos principais                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversation`         | id, user_id (nulo para visitante), title e kind (dados pelo bot; nulos nas antigas), status (`open`/`resolved`), created_at, updated_at                                                  |
| `conversation_message` | id (sequencial, define a ordem), conversation_id, role (`user`/`assistant`), content, source (`faq`/`llm`, só do assistente), ticket_id (fala que registra o chamado aberto), created_at |
| `ticket`               | id, number + code (`TKT-0001`, gerados pelo banco), client_id, assignee_id, subject, description, status, priority, conversation_id, created/updated/resolved/closed_at                  |
| `ticket_message`       | id (sequencial), ticket_id, author_id, content, internal (nota só da equipe), created_at                                                                                                 |

- **Código do chamado:** `number` é uma coluna identity e `code` é uma coluna gerada a partir dele
  (`formatTicketCode` no shared segue o mesmo formato). A numeração não depende de transação na API, o
  que importa porque o driver HTTP do Neon não tem transação interativa.
- **Ordem das mensagens:** pelo `id`, não pelo `created_at`. A transcrição anexada ao chamado entra num
  único INSERT, e todas as linhas ficam com o mesmo horário.
- **Histórico preservado:** `ticket.client_id` e `ticket_message.author_id` usam `restrict`; o
  responsável e a conversa de origem viram `null` se forem apagados. Contas não são apagadas, só desativadas.
- **Status:** `open` → `in_progress` / `waiting_client` → `resolved` → `closed`. `resolved` pode ser
  reaberto; `closed` é final (as transições ficam em `TICKET_STATUS_TRANSITIONS`).
- Datas das tabelas novas são `timestamp with time zone`; as do better-auth seguem como ele gera.

## Rotas do web

| Rota                                                                     | Acesso                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| `/` (landing page), `/atendimento/:conversa?`, `/entrar`, `/criar-conta` | Pública (entrar/criar conta só para quem não está logado) |
| `/chamados`, `/chamados/:codigo`                                         | `client`                                                  |
| `/chamados/novo`, `/conversas`                                           | Levam a `/atendimento` (o chamado nasce no chat)          |
| `/tecnico`, `/tecnico/chamados/:id`                                      | `technician`, `admin`                                     |
| `/admin/usuarios`                                                        | `admin`                                                   |
| `/design-system`                                                         | Só em dev                                                 |

## Roteiro

1. ~~`feat/telas-de-login-e-cadastro`~~ — concluída
2. ~~`feat/gestao-de-usuarios-admin`~~ — concluída
3. ~~`feat/modelo-de-chamados-e-conversas`~~ — concluída
4. ~~`feat/chatbot-faq-e-llm`~~ — concluída
5. ~~`feat/abertura-de-chamado-e-historico`~~ — concluída
6. ~~`feat/dashboard-do-tecnico`~~ — concluída
7. `feat/recuperacao-de-senha-e-verificacao-de-email` (adiada: precisa de um provedor de e-mail)
8. ~~`fix/link-ativo-no-menu`~~ — concluída
9. ~~`feat/identidade-visual-logo-e-simbolo`~~ — concluída
10. ~~`feat/landing-page`~~ — concluída
11. ~~`feat/sidebar-de-conversas-no-atendimento`~~ — concluída
12. ~~`feat/fluxos-guiados-e-novo-visual-do-chat`~~ — concluída
13. ~~`feat/abertura-de-chamado-pelo-chatbot`~~ — concluída
14. ~~`fix/diagnostico-e-correcoes-de-seguranca`~~ — concluída ([diagnóstico](seguranca/diagnostico-2026-10.md))
15. ~~`chore/revisao-de-seguranca-com-claude`~~ — concluída
16. ~~`feat/criar-conta-pelo-cartao-de-chamado`~~ — concluída
17. ~~`chore/conferir-migrations-pendentes-no-deploy`~~ — concluída ([fluxo de migrations](deploy.md#a-cada-mudança-no-banco-migrations))
18. `feat/cancelar-e-resolver-chamado-pelo-cliente`
19. `feat/wen-consulta-e-acoes-em-chamados`
