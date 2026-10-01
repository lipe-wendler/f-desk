<script setup lang="ts">
import { FwSectionLabel, FwTag } from '@f-desk/ui'

/** Página provisória: diz o que a tela fará e em qual tarefa ela será construída. */
defineProps<{ eyebrow: string; title: string; description: string; task: string }>()
</script>

<template>
  <section class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-8 shadow-card">
    <FwSectionLabel bar>{{ eyebrow }}</FwSectionLabel>
    <h1 class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em]">
      {{ title }}
    </h1>
    <p class="m-0 max-w-[60ch] text-ink-muted">{{ description }}</p>
    <slot />
    <div class="flex flex-wrap items-center gap-2 pt-2">
      <FwTag size="sm" system>Em construção</FwTag>
      <code class="font-mono text-[13px] text-ink-muted">{{ task }}</code>
    </div>
  </section>
</template>
