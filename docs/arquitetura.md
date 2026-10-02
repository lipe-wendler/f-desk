# Arquitetura

```
Navegador ──► Vercel (mesmo domínio)
               ├─ /*      → apps/web (SPA Vue estático)
               └─ /api/*  → api/index.js → apps/api (Hono) ──► Neon Postgres (Drizzle, driver HTTP)
                                                └──────────► Claude API (chatbot)
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
- **Chat sem login**: o visitante conversa com o chatbot sem conta; a conversa fica no navegador.
  Para abrir chamado, ele entra ou cria conta e a transcrição vai junto com o chamado.
  O chat público terá rate limit por IP guardado no Postgres (serverless não compartilha memória).

## Modelo de dados

Já existe (`packages/db/src/schema/auth.ts`): `user` (com `role`, `banned`…), `session`, `account`,
`verification`, `rate_limit`.

Próximas tarefas (`feat/modelo-de-chamados-e-conversas`):

| Tabela                 | Campos principais                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `conversation`         | id, user_id (nulo para visitante), created_at                                                                      |
| `conversation_message` | id, conversation_id, role (`user`/`assistant`), content, source (`faq`/`llm`), created_at                          |
| `ticket`               | id, code (`TKT-0001`), client_id, assignee_id, subject, description, status, priority, conversation_id, timestamps |
| `ticket_message`       | id, ticket_id, author_id, content, internal (nota só da equipe), created_at                                        |

Status e prioridades ficam em `packages/shared/src/tickets.ts`.

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
2. `feat/gestao-de-usuarios-admin`
3. `feat/modelo-de-chamados-e-conversas`
4. `feat/chatbot-faq-e-llm`
5. `feat/abertura-de-chamado-e-historico`
6. `feat/dashboard-do-tecnico`
7. `feat/recuperacao-de-senha-e-verificacao-de-email` (precisa de um provedor de e-mail)
