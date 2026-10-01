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
5. **Merge só por squash** na `main`. A branch é apagada depois do merge.

## O que garante isso

| Onde                                   | Checagem                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Hook `commit-msg` (Husky + commitlint) | Mensagem em Conventional Commits com descrição em kebab-case                               |
| Hook `pre-push`                        | Bloqueia push na `main` e nomes de branch fora do padrão                                   |
| CI (`.github/workflows/ci.yml`)        | Nome da branch, título do PR, commits da branch, Prettier, lint, typecheck, testes e build |

## Configuração no GitHub (manual, uma vez)

- _Settings → General → Pull Requests_: deixar marcado só **Allow squash merging** e ativar
  **Automatically delete head branches**.
- _Settings → Branches_: regra para `main` com **Require a pull request before merging** e
  **Require status checks to pass** (job `checks`, `branch-name` e `pr-title` do CI).
