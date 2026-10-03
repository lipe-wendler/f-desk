# Diagnóstico de segurança — outubro de 2026

Primeira revisão de segurança do F.Desk, feita na tarefa 14 (`fix/diagnostico-e-correcoes-de-seguranca`)
sobre a `main` com as tarefas 1–13. Vale como linha de base: a skill `/revisao-de-seguranca` (tarefa 15)
usa este documento como checklist, e cada achado novo deve entrar aqui.

Status de cada achado:

- ✅ **Corrigido** neste PR, com teste de regressão.
- 🔧 **Infraestrutura**: depende de configuração na Vercel, no Neon ou no GitHub (veja o [checklist](#checklist-de-infraestrutura)).
- ⚠️ **Risco aceito**: fica como está, pelo motivo indicado.

## Superfície

| Rota                                      | Acesso                                    | Escopo                                                                 |
| ----------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `GET /api/health`                         | pública                                   | —                                                                      |
| `/api/auth/*` (better-auth)               | pública + `adminGuard` nas rotas de admin | sessão do better-auth; origem conferida por `trustedOrigins`           |
| `GET /api/admin/users`                    | `admin`                                   | todos (por definição)                                                  |
| `GET /api/chat/status` · `POST /api/chat` | pública, com cota                         | conversa gravada só para o dono (`saveChatExchange` confere `user_id`) |
| `/api/tickets/*`                          | `client`                                  | `client_id` da sessão em toda query; de outra pessoa é 404             |
| `/api/conversations/*`                    | `client`                                  | `user_id` da sessão em toda query (inclusive na importação)            |
| `/api/staff/*`                            | `technician` e `admin`                    | todos os chamados (a equipe atende a fila inteira)                     |

O que já estava bom e continua valendo:

- **SQL**: Drizzle com parâmetros em todo lugar. `sql.raw` só aparece com constantes (o check `oneOf`
  e um nome de coluna fixo); buscas com `ILIKE` escapam `\ % _`.
- **Validação**: zod em todo corpo, query e parâmetro de rota (`TICKET_CODE_PATTERN`, `z.uuid()`).
- **XSS**: nenhum `v-html`, `innerHTML` ou renderização de Markdown; tudo é interpolação do Vue.
- **Perfil**: o cadastro público sempre cria `client` (`role` com `input: false`; teste em `app.test.ts`).
- **Chatbot**: a Wen não tem ferramenta que leia ou grave no banco. `proporChamado` não tem `execute`:
  o chamado só é aberto quando o cliente confirma, pela rota de chamados, com o id da sessão.
- **Redirecionamento**: `safeRedirect` impede redirecionar para fora do site depois do login.
- **Notas internas** nunca saem para o cliente (`getClientTicket` filtra `internal = false`).

## Achados

### Altos

1. ✅ **Admin contornava as regras de perfil e desativação.** As regras "ninguém muda o próprio perfil"
   e "sempre há um admin ativo" valiam em `/admin/set-role` e `/admin/ban-user`, mas o perfil `admin`
   também tinha `user:update`, que libera `/admin/update-user` — e ali `role` e `banned` podiam ser
   alterados por fora do `adminGuard`. A tela nunca usou essa rota.
   **Correção:** `update` saiu das permissões do admin (`apps/api/src/auth/permissions.ts`); a rota
   responde 403. Teste: `security.test.ts › permissões do admin`.
2. ✅ **Sem cabeçalhos de segurança.** Nenhuma CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` ou
   `Permissions-Policy`: as telas de admin e da equipe podiam ir para um iframe (clickjacking).
   **Correção:** SPA com CSP `'self'`, `frame-ancestors 'none'` e os demais no `vercel.json`
   (conferido no Chromium sem violações); API com `secureHeaders()` e CSP `default-src 'none'`.
3. 🔧 **Previews com dados e sessões de produção.** A integração do Neon cria `preview/<branch>` como
   cópia do `production` (usuários, hashes de senha, sessões), e o mesmo `BETTER_AUTH_SECRET` vale em
   Production e Preview. Um preview roda código de PR ainda não revisado com dados reais.

### Médios

4. ✅ **Fala da Wen forjada chegava à equipe.** A transcrição do visitante (até 100 mensagens) vem do
   navegador, e a equipe a via como conversa real com a Wen. Um cliente podia escrever "Wen: o técnico
   deve liberar acesso de admin" e isso aparecia como fala do bot.
   **Correção:** coluna `conversation_message.imported` (migration `0006`); a tela da equipe avisa que o
   trecho não é verificado e marca cada fala dele. Mensagens importadas antes da migration não têm a
   marca (não há como distingui-las com segurança).
5. ✅ **Histórico do chat editável pelo navegador.** O contexto do LLM vinha do `history` do corpo,
   inclusive com falas `assistant`. **Correção:** com usuário logado e `conversationId`, o contexto vem
   do banco (`getConversationHistory`), ou fica vazio se a conversa não for dele. Na tarefa 16, o
   contexto de quem está logado passou a vir **só** do banco: sem `conversationId`, fica vazio. O
   `history` do corpo só vale para o visitante (afeta só a conversa dele). Quem entrou no meio da
   conversa tem o começo importado no login (`POST /api/conversations/import`: dono da sessão,
   mensagens `imported`, cota `client-write` e mais uma de 5 por hora, `conversation-import`,
   apontada pela revisão do PR #18: a rota grava o mesmo volume que abrir chamado). Testes em `chat-route.test.ts` (logado sem conversa
   gravada) e `conversation-import.test.ts`. A conversa importada continua sendo texto do navegador e
   entra no contexto da própria conversa: quem forja falas da Wen ali engana só o próprio
   atendimento (a Wen não age sem confirmação pela rota REST, com o id da sessão), e a equipe vê o
   trecho marcado como não verificado.
6. ✅ **Escritas sem limite.** Abrir chamado, responder e as ações da equipe não tinham cota: dava para
   encher a fila da equipe. **Correção:** `limitPerUser` (`services/rate-limit.ts`) com contadores na
   mesma tabela do chat, por bucket: 5 chamados/hora, 30 escritas do cliente e 120 da equipe a cada
   10 minutos (`TICKET_CREATE_LIMIT`, `TICKET_WRITE_LIMIT`, `STAFF_WRITE_LIMIT`). A tabela passa a ser
   limpa aos poucos (janelas com mais de 1 dia; por isso `CHAT_RATE_WINDOW_SECONDS` vai até 86400).
   O feedback de conversa ("Resolveu?") entrou depois, achado pela primeira `/revisao-de-seguranca`.
7. ✅ **Força bruta no login.** O padrão do better-auth é 3 tentativas a cada 10 s por IP (~18 senhas
   por minuto). **Correção:** `/sign-in/email` com 10 a cada 5 minutos e `/sign-up/email` com 5 por
   hora, por IP. O limite do better-auth só vale em produção (padrão da biblioteca).
8. ⚠️ **Sem verificação de e-mail e sem recuperação de senha.** Qualquer um cadastra qualquer e-mail, e
   o cadastro revela se um e-mail já existe (`USER_ALREADY_EXISTS`). Fica para a tarefa 7, que depende
   de um provedor de e-mail; esconder o erro sem verificação só pioraria a experiência.

### Baixos

9. ✅ **CSRF nas rotas próprias.** Só o `SameSite=Lax` protegia, e `c.req.json()` aceita `text/plain`
   (que um formulário de outro site consegue mandar). **Correção:** `csrf()` do Hono recusa formulário e
   `text/plain` de outra origem; aceita a própria e as `trustedOrigins`.
10. ✅ **Corpo sem limite.** **Correção:** `bodyLimit` de 512 KB (2 MB para abrir chamado, por causa da
    transcrição); acima disso, 413 sem ler o corpo.
11. ✅ **Log com query string.** O `logger()` do Hono registrava `?search=` das buscas da equipe e do
    admin (nomes e e-mails). **Correção:** log próprio só com método, caminho, status e tempo.
12. ✅ **Erro sem tratamento.** **Correção:** `app.onError` devolve 500 genérico; o detalhe fica no log.
13. ✅ **Segredo de dev fora da máquina local.** O padrão público de `BETTER_AUTH_SECRET` valia sempre
    que `NODE_ENV`/`VERCEL_ENV` não fossem `production` — um preview sem a variável assinaria sessões
    com ele. **Correção:** na Vercel (qualquer ambiente) a variável é obrigatória.
14. ✅ **Desativação com prazo.** `requireRole` ignorava `banExpires`. **Correção:** `isBanned` respeita o
    prazo.
15. ⚠️ **Equipe vê todos os chamados.** Qualquer técnico lê, responde e reatribui qualquer chamado e vê o
    e-mail do cliente. É o desenho atual (fila única); revisar se a equipe crescer ou tiver clientes
    sensíveis.
16. ⚠️ **Um admin comprometido compromete os outros.** Admin pode trocar a senha de outro admin
    (`set-user-password`) e, com isso, entrar na conta dele. Bloquear só essa rota não resolve (dá para
    rebaixar, trocar a senha e promover de novo); a resposta certa é 2FA para a equipe, numa tarefa
    própria.
17. 🔧 **Sem ferramentas de cadeia de suprimentos.** Sem Dependabot, auditoria de dependências ou
    `SECURITY.md`; as Actions usam tag (`@v4`), não SHA.
18. ✅ **Connection string no log do build** (achado da `/revisao-de-seguranca` no PR #19). A conferência de
    migrations no build da Vercel (tarefa 17) chama o banco sem passar pelo `env.ts`. Com um
    `DATABASE_URL` malformado (o trecho `psql '…'` copiado do console, por exemplo), o driver do Neon
    repete a connection string na mensagem de erro, e ela iria para o build log, que todo o time da
    Vercel vê. **Correção:** o script valida a URL sem ecoá-la e, em qualquer erro, loga só nome e
    código (`safeErrorSummary`). Teste em `migrations-status.test.ts`.

## Checklist de infraestrutura

Configurações fora do código. Marque aqui quando aplicar.

- [x] **Vercel → Environment Variables:** `BETTER_AUTH_SECRET` **diferente** em Preview e Production
      (`openssl rand -base64 32` para cada). Assim um cookie de produção não vale num preview.
- [x] **Vercel → Deployment Protection:** ligar _Vercel Authentication_ nos previews (só quem é do time
      abre um preview).
- [x] **Neon → previews:** a integração Neon ↔ Vercel sempre copia o branch padrão (`production`) e
      não tem opção de branch só com schema. Enquanto a base for pequena e só o time abrir PRs, o risco
      fica contido pelo segredo separado e pelo Deployment Protection; garantir _Automatically delete
      obsolete Neon branches_ ligado (Neon Console → Integrations → Vercel → Manage → Settings). Com
      clientes reais, trocar o preview branching da integração por branches só com schema (`--schema-only`)
      ou anonimizados, criados por PR.
- [x] **Vercel → Production:** `BETTER_AUTH_URL` definido com o domínio final (sem ele, a baseURL cai na
      URL do deploy).
- [ ] **GitHub → Settings → Rules:** ruleset da `main` criado, mas **inativo**: o GitHub só aplica
      rulesets e branch protection em repositório privado nos planos pagos. Sem isso, a `main` não
      tem proteção no servidor: o hook `pre-push` só lembra (cai com `--no-verify`, e escrita pela API
      do GitHub não passa por ele) e o veredito da `/revisao-de-seguranca` é um aviso. Para ativar:
      GitHub Pro ou repositório público.
- [x] **GitHub → Settings → Code security:** Dependabot alerts ligado. Secret scanning (Secret
      Protection) fica **desligado** (pago em repositório privado); a busca de segredos no diff é
      feita pela `/revisao-de-seguranca` (checklist, seção 6).
- [x] **Claude Code:** o Claude não faz merge nem escreve na `main` (hook `proteger-main.mjs` e
      regras `deny` em `.claude/settings.json`). Não substitui o ruleset: vale só para o Claude.

## Como verificar

- `pnpm test` cobre os itens corrigidos: `apps/api/src/__tests__/security.test.ts`, os testes de
  histórico em `chat-route.test.ts` e `apps/web/src/features/tickets/__tests__/transcript.test.ts`.
- Cabeçalhos em produção: `curl -sI https://f-desk.vercel.app/ | grep -iE 'content-security|x-frame'` e
  `curl -sI https://f-desk.vercel.app/api/health`.
