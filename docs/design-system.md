# Design system

O F.Desk usa o design system da marca **F.Wendler**, portado para Vue em [`packages/ui`](../packages/ui/README.md)
(brand book completo, tokens, componentes e scripts).

- Fonte: artifact "F.Wendler" (Design System) no claude.ai.
- **Dark é o padrão**, com os neutros quentes da Anthropic (`warm-*`, `ivory`, `slate`); o amarelo
  `#FFC629` continua sendo o único acento. O light é o original da marca.
- Tokens em `packages/ui/src/tokens/tokens.json` → `pnpm --filter @f-desk/ui tokens` gera `tokens.css`.
  O CI falha se o CSS estiver desatualizado ou se algum par de cores perder contraste.
- No app, use os componentes `Fw*` e os utilitários Tailwind ligados aos tokens
  (`bg-surface`, `text-ink-muted`, `font-display`…). Nunca escreva hex em componente.
