# F.Desk — guia para o Claude

Sistema de tickets da F.Wendler. Leia `README.md` e `docs/arquitetura.md` antes de mudar algo grande.

## Fluxo Git (obrigatório)

- Nunca commitar nem dar push na `main`.
- Uma branch por tarefa, criada a partir da `main` só quando a tarefa começar:
  `<tipo>/<descricao-da-tarefa-em-kebab-case>` (ex.: `feat/telas-de-login-e-cadastro`).
- Commits em Conventional Commits com descrição em kebab-case: `feat(web): adiciona-tela-de-login`.
- Ao terminar: PR para a `main` com título no mesmo padrão e o template preenchido. Merge só por squash.
- Detalhes em `docs/git-workflow.md`.

## Comandos

- `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm format`
- Rode todos antes de abrir PR (o CI roda os mesmos, mais `pnpm format:check`).

## Convenções

- UI: componentes `Fw*` de `@f-desk/ui` e utilitários Tailwind ligados aos tokens. Nunca escreva hex.
  Mudou `tokens.json`? Rode `pnpm --filter @f-desk/ui tokens` e `check:contrast`.
- Perfis: `client` (cadastro próprio), `technician` e `admin` (criados pelo admin). Regras de acesso
  sempre na API (`requireRole`); o router do web só espelha.
- Textos da interface em português do Brasil; voz da marca no `packages/ui/README.md`.
- Schema do banco em `packages/db/src/schema`; mudou? `pnpm db:generate` e versione a migration.
