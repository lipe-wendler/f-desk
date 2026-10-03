# Checklist de segurança do F.Desk

Base: [`docs/seguranca/diagnostico-2026-10.md`](../../../docs/seguranca/diagnostico-2026-10.md). Cada item
vem de um achado real ou de uma garantia que o projeto já tem e não pode perder. Itens marcados com
**(bloqueia)** viram achado alto quando violados.

## 1. Acesso e escopo por dono

- [ ] Toda rota nova em `apps/api/src/routes` tem `requireRole(...)` (ou é pública de propósito, e o
      motivo está comentado). O router do web só espelha: regra de acesso nunca fica só no front. **(bloqueia)**
- [ ] Recurso de cliente é sempre buscado com o id **da sessão** (`c.get('user')!.id`) no `WHERE`
      (`client_id`, `user_id`). Nada de id de dono vindo do corpo, da query ou do modelo. **(bloqueia)**
- [ ] Recurso de outra pessoa responde 404 (não 403), para não revelar que existe.
- [ ] Notas internas (`ticket_message.internal`) nunca saem em rota de cliente nem em ferramenta da Wen. **(bloqueia)**
- [ ] Mudança de perfil e desativação só por `/admin/set-role` e `/admin/ban-user` (com `adminGuard`).
      Nenhuma permissão nova no `admin` em `auth/permissions.ts` sem justificar (ex.: `update`,
      `impersonate`, `delete` estão fora de propósito). **(bloqueia)**
- [ ] Cadastro público continua criando só `client` (`role` com `input: false`).

## 2. Entrada e banco

- [ ] Todo corpo, query e parâmetro de rota passa por zod (`safeParse`) antes de usar.
- [ ] SQL só pelo Drizzle ou `sql\`\`` com parâmetros. `sql.raw` só com constantes do código;
      nunca concatenar texto vindo de fora. **(bloqueia)**
- [ ] `ILIKE` escapa `\ % _` no termo buscado.
- [ ] Escrita com várias tabelas usa `db.batch` (transacional no driver HTTP).
- [ ] Migration nova: gerada por `pnpm db:generate`, sem dado de teste, testada num branch do Neon.
      Renomear ou apagar coluna segue o fluxo em duas tarefas de `docs/deploy.md`.

## 3. Abuso e limites

- [ ] Rota nova que escreve tem limite por usuário (`limitPerUser` em `services/rate-limit.ts`) ou
      um motivo para não ter.
- [ ] Rota pública nova tem cota por IP (hash com `quotaKey`), como o chat.
- [ ] Campos de texto têm limite de tamanho no schema zod; corpo grande é barrado pelo `apiBodyLimit`.

## 4. Chatbot (Wen)

- [ ] Ferramenta nova da Wen recebe o usuário por closure do servidor (sessão), **nunca** por argumento
      do modelo. O `inputSchema` não tem `userId`, `clientId` nem e-mail. **(bloqueia)**
- [ ] Ferramenta que muda algo não tem `execute`: vira proposta e só acontece com confirmação do
      cliente, pela rota REST que confere o perfil. **(bloqueia)**
- [ ] Ferramenta de leitura devolve só dados do próprio cliente, sem notas internas e sem dados de
      outras pessoas (nome de técnico pode; e-mail não).
- [ ] Conteúdo de chamado e conversa vai para o modelo como dado, e o prompt diz que não é instrução.
- [ ] Contexto do LLM com conversa gravada vem do banco, não do `history` do navegador.
- [ ] Texto vindo do navegador (transcrição) é marcado como `imported` e não aparece para a equipe
      como fala da Wen.

## 5. Front-end

- [ ] Nada de `v-html`, `innerHTML`, `eval`, `new Function` ou renderização de Markdown sem sanitizar. **(bloqueia)**
- [ ] Redirecionamento depois de login passa por `safeRedirect`.
- [ ] Script, estilo, imagem ou fonte externa nova: a CSP do `vercel.json` precisa permitir de
      propósito (por padrão só `'self'`).

## 6. Segredos, logs e configuração

- [ ] Nenhum segredo, token, connection string ou `.env` no diff. **(bloqueia)**
- [ ] Variável de ambiente nova sensível é obrigatória na Vercel em `apps/api/src/env.ts`
      (`isProduction`), sem valor padrão público.
- [ ] Log não registra corpo, senha, token, e-mail ou query string de busca.
- [ ] Erro novo para o cliente não expõe stack, SQL ou detalhe interno (o `onApiError` cuida do 500).
- [ ] Cabeçalhos de segurança (`vercel.json` e `apiSecureHeaders`) e `apiCsrf` continuam aplicados.

## 7. Dependências

- [ ] Dependência nova é conhecida e mantida; `pnpm audit --prod` sem alta ou crítica nova.
- [ ] Lockfile atualizado pelo `pnpm install`, nunca à mão.

## 8. Testes

- [ ] Regra de acesso nova tem teste (401 visitante, 403 perfil errado, 404 recurso de outra pessoa),
      no padrão de `apps/api/src/__tests__/security.test.ts`.

## 9. Ferramentas do processo

Vale quando o diff toca `.claude/**`, `.husky/**`, `.github/workflows/**`, `.mcp.json`,
`commitlint.config.js` ou `CLAUDE.md`. Hooks do Claude Code e do Git rodam na máquina de quem abre o
projeto.

- [ ] Hook (Claude Code ou Git) não executa nem interpola texto vindo de fora (`tool_input`,
      `tool_response`, mensagem de commit, nome de branch) e não faz chamada de rede. **(bloqueia)**
- [ ] Nada enfraquece a revisão: o auditor continua só de leitura, o veredito segue a regra de
      severidade, a skill continua sendo chamada após abrir PR, o pre-push e o CI não perdem
      checagens. **(bloqueia)**
- [ ] Permissão nova em `.claude/settings.json` (`allow`) ou MCP novo em `.mcp.json` tem motivo
      escrito no PR; nada de liberar escrita ampla (`Bash(*)`, ferramentas de escrita de MCP).
- [ ] Workflow do GitHub novo não usa `pull_request_target` com checkout do código do PR, não expõe
      segredo em log e fixa as actions por versão.
