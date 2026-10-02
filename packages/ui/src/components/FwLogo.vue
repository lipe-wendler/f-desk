<script setup lang="ts">
import { computed } from 'vue'
import { LOGO_PATHS, LOGO_VIEWBOX, SYMBOL_VIEWBOX } from './logo-paths'

/**
 * Logo do F.Desk em SVG. `full` é o cubo com "F.Desk"; `symbol` é só o cubo.
 * As letras herdam a cor do texto (`ink` por padrão), então a mesma logo serve nos dois temas.
 * `mono` pinta tudo com a cor do texto (logo branca sobre o amarelo, impressão etc.).
 * Com `decorative` some para leitores de tela (use quando um texto ao lado já nomeia a marca).
 * `height` (px) define o tamanho; sem ele vale a altura do CSS (32px).
 */
const props = withDefaults(
  defineProps<{
    variant?: 'full' | 'symbol'
    mono?: boolean
    label?: string
    decorative?: boolean
    height?: number
  }>(),
  { variant: 'full', mono: false, label: 'F.Desk', decorative: false },
)

const viewBox = computed(() => (props.variant === 'symbol' ? SYMBOL_VIEWBOX : LOGO_VIEWBOX))
</script>

<template>
  <svg
    :class="['fw-logo', `fw-logo-${variant}`, { 'fw-logo-mono': mono }]"
    :viewBox="viewBox"
    :style="height ? { height: `${height}px` } : undefined"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : label"
    :aria-hidden="decorative ? 'true' : undefined"
    focusable="false"
  >
    <path class="fw-logo-top" :d="LOGO_PATHS.top" />
    <path class="fw-logo-side" :d="LOGO_PATHS.side" />
    <path class="fw-logo-shade" :d="LOGO_PATHS.shade" />
    <template v-if="variant === 'full'">
      <path class="fw-logo-dot" :d="LOGO_PATHS.dot" />
      <path class="fw-logo-text" :d="LOGO_PATHS.text" />
    </template>
  </svg>
</template>
