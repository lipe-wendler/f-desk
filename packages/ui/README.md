# @f-desk/ui — design system F.Wendler

Design system da marca **F.Wendler** portado para Vue 3, usado por todas as telas do F.Desk.
Fonte: artifact "F.Wendler" (Design System) no claude.ai. Os tokens moram em
[`src/tokens/tokens.json`](src/tokens/tokens.json) e geram [`src/styles/tokens.css`](src/styles/tokens.css).

## Como usar

```css
/* apps/web/src/styles/main.css */
@import 'tailwindcss';
@import '@f-desk/ui/theme.css'; /* utilitários Tailwind ligados aos tokens */
@import '@f-desk/ui/styles.css'; /* fontes, tokens, base e classes fw-* */
```

```vue
<script setup lang="ts">
import { FwButton, FwInput } from '@f-desk/ui'
</script>

<template>
  <FwInput v-model="email" label="E-mail" icon="mail" />
  <FwButton arrow>Abrir chamado</FwButton>
</template>
```

- **Tema**: `data-theme="dark"` (padrão) ou `"light"` no `<html>`. Use `useTheme()` para trocar e lembrar a escolha.
- **Tailwind**: as cores, fontes, raios e sombras do Tailwind foram substituídos pelos tokens —
  `bg-bg`, `bg-surface`, `bg-surface-raised`, `text-ink`, `text-ink-muted`, `border-line`, `bg-accent`,
  `text-on-accent`, `text-accent-text`, `font-display`, `font-mono`, `rounded-md`, `rounded-pill`, `shadow-card`.
  Espaçamento na grade de 4px (`p-6` = 24px = `space-5`). Nunca escreva hex em componente.
- **Componentes Vue** (`Fw*`): `FwButton`, `FwIconButton`, `FwIcon`, `FwSectionLabel`, `FwInput`, `FwSelect`,
  `FwTextarea`, `FwCheckbox`, `FwRadio`, `FwSwitch`, `FwTag`, `FwTabs`, `FwMedia`, `FwListRow`, `FwStepper`,
  `FwMetricCard`, `FwFeatureCard`, `FwAppHeader`, `FwDialog` (modal sobre `<dialog>`, com `v-model:open`). Campos e seletores usam `v-model`.
  `FwInput` com `type="password"` e `revealable` ganha o botão de mostrar/ocultar senha.
  `FwButton variant="danger"` (fundo `danger`, texto `on-danger`) só para ações destrutivas.
- **Extensões do F.Desk**: `responsive.css` (ajustes de celular) e `extensions.css` (peças criadas aqui,
  como o botão de senha) ficam separados para o `components.css` continuar igual à fonte.
- **Só CSS**: os módulos de landing do design system (`fw-hero`, `fw-module`, `fw-quote-*`, `fw-principle`,
  cards de projeto) continuam em `components.css`, mas não ganharam componente Vue porque o helpdesk não os usa.

## Scripts

| Comando                                   | O que faz                                                 |
| ----------------------------------------- | --------------------------------------------------------- |
| `pnpm --filter @f-desk/ui tokens`         | Regera `tokens.css` a partir de `tokens.json`             |
| `pnpm --filter @f-desk/ui check:tokens`   | Falha se `tokens.css` estiver desatualizado               |
| `pnpm --filter @f-desk/ui check:contrast` | Confere contraste WCAG dos pares de tokens nos dois temas |
| `pnpm --filter @f-desk/ui test`           | As duas checagens acima + testes dos componentes          |

---

# Brand book

Marca pessoal de Felipe Wendler: produtos digitais na interseção de pessoas, tecnologia e automação.
Preto, amarelo e concreto; precisa, humana, sem ruído.

**Ideas · Systems · People · Progress**

## Posicionamento e voz

- A marca fala em primeira pessoa ("I design and build…"), direto ao leitor ("Tell me about your project"). Copy do site em inglês; conteúdo para o público brasileiro pode ser em PT-BR com a mesma voz.
- Frases curtas e concretas, verbo primeiro nos botões: "Let's connect", "See my work", "Download CV", "Learn more".
- Sentence case em títulos e botões; CAIXA ALTA só nos rótulos técnicos em Space Mono (`eyebrow`, tags de sistema).
- Contraste de ideias no formato "X over Y": People over features · Clarity over complexity · Useful over perfect · Progress over theory.
- Método em quatro verbos: Understand → Connect → Solve → Grow.
- Sem emoji, sem exclamações, sem métricas de enfeite — um número só entra se for real ("10+ projects delivered").

## Cor

- **Dark é o tema padrão**; light é a variação. Os dois usam os mesmos nomes de token — nunca escreva hex em componente.
- Paleta da marca (`brand-*`): amarelo `brand-yellow` #FFC629, preto `brand-black` #0B0B0B, grafite `brand-graphite` #1E1E1E, stone `brand-stone` #363636, cinzas `brand-gray`/`brand-fog`/`brand-mist`/`brand-smoke`, brancos `brand-white`/`brand-paper`. Componentes consomem os tokens semânticos, que apontam para ela.
- **Dark do F.Desk com os neutros quentes da Anthropic.** No tema escuro, os neutros frios da marca deram lugar aos tons do Claude.ai; o amarelo continua sendo o único acento. O tema light não mudou.

  | token                     | dark               | antes (F.Wendler) |
  | ------------------------- | ------------------ | ----------------- |
  | `bg`                      | `warm-900` #1F1E1D | #0B0B0B           |
  | `surface`                 | `warm-800` #262624 | #131313           |
  | `surface-raised`, `field` | `warm-700` #30302E | #1E1E1E           |
  | `line`                    | `warm-600` #3D3D3A | #363636           |
  | `line-strong`             | `warm-500` #85837C | #6B6B6B           |
  | `ink`                     | `ivory` #FAF9F5    | #F5F5F5           |
  | `ink-muted`               | `warm-fog` #C2C0B6 | #A3A3A3           |
  | `on-accent`               | `slate` #141413    | #0B0B0B           |
  | `accent-soft`             | #3B3115            | #2A2206           |

  Os valores foram conferidos com `check:contrast`: texto ≥4.5:1 e contornos/foco ≥3:1 em todas as superfícies.

- Página em `bg`; cards e painéis em `surface`; trilhos, hover e camadas acima em `surface-raised`; inputs em `field`.
- Texto em `ink`; secundário em `ink-muted`. Ambos passam 4.5:1 em `bg`, `surface` e `surface-raised` nos dois temas.
- O amarelo é acento, não fundo: `accent` preenche o CTA primário, a tab ativa, controles ligados e marcadores — texto sobre ele sempre `on-accent` (preto). Em uma tela, o amarelo ocupa no máximo ~10% da área.
- Amarelo como **texto** é sempre `accent-text`: no dark é o próprio amarelo; no light vira `brand-yellow-ink` (#8A6500), porque o amarelo puro sobre branco fica em 1.6:1. Vale para a palavra destacada do título ("System", "impact.").
- `line` é decorativa (divisores, borda de card); `line-strong` contorna controles e passa 3:1.
- `success` e `danger` só em validação e estados, sempre com ícone ou palavra — nunca só pela cor.

## Tipografia

Três famílias, cada uma com um papel fixo — nunca troque os papéis:

- **Urbanist** (`--font-display`) — voz da marca: títulos do hero, headings, títulos de seção, chamadas principais, títulos de card e peças de brand/LP. Estilos `display` 64/72 Bold · `h1` 48/56 Bold · `h2` 32/40 Semibold · `h3` 24/32 Semibold, com tracking levemente negativo.
- **DM Sans** (`--font-sans`) — a interface: texto corrido, navegação, botões, cards, formulários, descrições. Estilos `body-lg` 18/28 · `body` 16/24 · `small` 14/20 · `label` 14/20 Semibold · `caption` 12/16.
- **Space Mono** (`--font-mono`) — a camada técnica: rótulos de seção e kickers (`eyebrow`, CAIXA ALTA, tracking 0.16em), metadados e datas (`meta`), índices e números de passo (`index`), tags de sistema (`Tag system`), código e pequenas anotações (`code`). Só pesos 400 e 700; nunca em frases longas.
- Destaque uma única palavra por título com `accent-text` (classe `fw-hl` ou utilitário `text-accent-text`).
- Nunca negrito em texto corrido além de uma ênfase por parágrafo.

## Espaço, forma e profundidade

- Grade de 4px: `space-1` 4 → `space-9` 96. Card: padding `space-5`; painel de seção: `space-6`; entre seções: `space-7`–`space-9`.
- Raios: `radius-sm` (inputs), `radius-md` (cards, thumbnails), `radius-lg` (painéis, hero), `radius-pill` (tudo que é acionável e curto — botões, tags, tabs, switch).
- Profundidade no dark vem de camadas quentes (`bg` → `surface` → `surface-raised`) + `line`, sem sombra. No light, `shadow-card` suave em cards e painéis. `shadow-glow` só no hover do primário e no passo atual do stepper.
- Alturas de controle: `control-sm` 36, `control-md` 44, `control-lg` 56. Conteúdo até `container` 1280px.

## Estados e movimento

- Hover: primário → `accent-hover`; secundários → borda em `ink`; ghost/linhas → `surface-raised`. Seta de CTA desliza 2px.
- Foco: anel sólido de 2px em `focus` com 2px de offset (amarelo no dark, quase-preto no light) — ≥3:1 em qualquer superfície.
- Transições de 150ms, ease. Nada pulsa, nada gira.

## Imagem e arte

- Direção fotográfica: arquitetura em concreto, planos angulosos, luz dura, o amarelo como único acento de cor. Sem stock com pessoas posadas, sem gradientes roxo-azulados.
- As imagens são geradas fora do código (GPT, Midjourney etc.) e entram pelo componente `FwMedia` (ou pela prop `image` do `FwListRow`). Motivo recorrente: sol/disco amarelo atrás de planos de concreto, cortado por linhas de luz.
- Sem imagem ainda, `FwMedia` mostra um placeholder hachurado com a proporção — nunca deixe um bloco vazio sem ele.

## Iconografia

- Ícones de traço 24×24, linha 1.6, pontas arredondadas, via componente `FwIcon` (herda a cor do texto). Estilo compatível com Lucide caso precise de um ícone que não está no set.
- Ícone de destaque de card em `accent-text`; o resto em `ink`. Sem emoji e sem ícones preenchidos.

## Logo

- Ainda não há arquivo de logo: o wordmark é tipográfico — "F.Wendler" (ou "F.Desk" no produto) em Urbanist Bold,
  tracking −0.02em, cor `ink`. Nunca amarelo, nunca contornado.
