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
  - **Visitante:** a conversa fica só no navegador (`localStorage`). **Logado:** a API também grava
    pergunta e resposta em `conversation`/`conversation_message`, com a origem (`faq`/`llm`).
  - Ao entrar na conta, a conversa do visitante segue no navegador e vai junto com o chamado
    (abertura de chamado na tarefa 5).
  - **Limite:** 20 mensagens a cada 10 minutos por conta ou por IP, contado no Postgres
    (`chat_rate_limit`; serverless não compartilha memória). O IP é guardado como hash.

## Modelo de dados

Schema em `packages/db/src/schema`; status, prioridades e papéis das mensagens vêm de
`packages/shared/src/tickets.ts`, e os checks do banco usam as mesmas listas.

- **Auth** (`auth.ts`, gerado pelo better-auth): `user` (com `role`, `banned`…), `session`, `account`,
  `verification`, `rate_limit`.
- **Limite do chat** (`chat.ts`): `chat_rate_limit` (key, window_start, count), janela fixa por chave.
- **Chamados e conversas** (`tickets.ts`):

| Tabela                 | Campos principais                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversation`         | id, user_id (nulo para visitante), created_at, updated_at                                                                                                               |
| `conversation_message` | id (sequencial, define a ordem), conversation_id, role (`user`/`assistant`), content, source (`faq`/`llm`, só do assistente), created_at                                |
| `ticket`               | id, number + code (`TKT-0001`, gerados pelo banco), client_id, assignee_id, subject, description, status, priority, conversation_id, created/updated/resolved/closed_at |
| `ticket_message`       | id (sequencial), ticket_id, author_id, content, internal (nota só da equipe), created_at                                                                                |

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

| Rota                                                         | Acesso                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| `/`, `/entrar`, `/criar-conta`                               | Pública (entrar/criar conta só para quem não está logado) |
| `/chamados`, `/chamados/novo`, `/chamados/:id`, `/conversas` | `client`                                                  |
| `/tecnico`, `/tecnico/chamados/:id`                          | `technician`, `admin`                                     |
| `/admin/usuarios`                                            | `admin`                                                   |
| `/design-system`                                             | Só em dev                                                 |

## Roteiro

1. ~~`feat/telas-de-login-e-cadastro`~~ — concluída
2. ~~`feat/gestao-de-usuarios-admin`~~ — concluída
3. ~~`feat/modelo-de-chamados-e-conversas`~~ — concluída
4. ~~`feat/chatbot-faq-e-llm`~~ — concluída
5. `feat/abertura-de-chamado-e-historico`
6. `feat/dashboard-do-tecnico`
7. `feat/recuperacao-de-senha-e-verificacao-de-email` (precisa de um provedor de e-mail)
