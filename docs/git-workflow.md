# Fluxo Git

1. **Nunca altere a `main` diretamente.** Toda mudança entra por PR.
2. **Uma branch por tarefa**, criada a partir da `main` atualizada **só quando a tarefa começar**:
   `<tipo>/<descricao-da-tarefa-em-kebab-case>` — ex.: `feat/telas-de-login-e-cadastro`,
   `fix/redirect-apos-login`, `chore/atualiza-dependencias`.
   Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `style`, `perf`, `build`.
3. **Commits na branch da tarefa** seguindo [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/),
   com a descrição em kebab-case: `tipo(escopo opcional): descricao-em-kebab-case`.
   - `feat(web): adiciona-tela-de-login`
   - `fix(api): corrige-permissao-do-tecnico`
   - Escopos usados: `web`, `api`, `ui`, `db`, `shared`, `config`.
4. **PR ao terminar a tarefa**, com título no mesmo padrão (ele vira a mensagem do squash) e o template preenchido.
5. **Revisão de segurança antes do merge**: `/revisao-de-seguranca <número do PR>` no Claude Code (o
   Claude roda sozinho logo depois de abrir o PR). Com veredito **Bloqueado**, não faça o merge até
   os achados serem corrigidos (é regra do fluxo; o GitHub não impede, veja abaixo). Veja [Revisão de segurança](#revisão-de-segurança).
6. **Merge só por squash** na `main`. A branch é apagada depois do merge.

## O que garante isso

| Onde                                          | Checagem                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Hook `commit-msg` (Husky + commitlint)        | Mensagem em Conventional Commits com descrição em kebab-case                               |
| Hook `pre-push`                               | Bloqueia push para a `main` (inclusive `HEAD:main`) e nomes de branch fora do padrão       |
| Hook do Claude Code (`.claude/settings.json`) | Depois de abrir um PR, o Claude é lembrado de rodar a `/revisao-de-seguranca`              |
| CI (`.github/workflows/ci.yml`)               | Nome da branch, título do PR, commits da branch, Prettier, lint, typecheck, testes e build |

## Configuração no GitHub (manual, uma vez)

- _Settings → General → Pull Requests_: deixar marcado só **Allow squash merging** e ativar
  **Automatically delete head branches**.
- _Settings → Rules → Rulesets_: ruleset `main` com **Require a pull request before merging** (0
  aprovações), **Require status checks to pass** (`checks`, `branch-name` e `pr-title`), **Restrict
  deletions** e **Block force pushes**. Já está criado, mas **o GitHub só aplica rulesets e branch
  protection em repositório privado nos planos pagos** (Pro, Team): no plano gratuito ele fica
  salvo e inativo. **Enquanto isso, nada no servidor protege a `main`:** o hook `pre-push` só
  lembra (cai com `--no-verify`, e escrita pela API do GitHub nem passa por ele), e o veredito da
  revisão de segurança é um aviso que depende de quem faz o merge respeitá-lo. Para ativar de
  verdade, assine o GitHub Pro ou torne o repositório público.

## Revisão de segurança

Rodada padronizada com o Claude Code antes de cada merge, sem GitHub Actions:

- **Skill** `.claude/skills/revisao-de-seguranca/`: `/revisao-de-seguranca [número do PR]`. Monta o
  escopo (diff do PR ou da branch contra a `main`), chama o auditor, confere os achados graves e
  publica o relatório como comentário no PR.
- **Subagent** `.claude/agents/auditor-de-seguranca.md`: só lê (sem `Write`/`Edit`), aplica o
  [checklist](../.claude/skills/revisao-de-seguranca/checklist.md) e devolve achados com arquivo,
  linha, cenário de exploração, severidade e veredito (**Liberado**, **Liberado com ressalvas** ou
  **Bloqueado**).
- **Hook** `PostToolUse` em `.claude/settings.json`: quando o Claude abre um PR (MCP do GitHub ou
  `gh pr create`), injeta o lembrete de rodar a revisão naquele PR.
- O checklist nasce do [diagnóstico de segurança](seguranca/diagnostico-2026-10.md). Achado novo
  que vale para todo PR entra nos dois.
