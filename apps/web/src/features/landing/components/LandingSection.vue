<script setup lang="ts">
import { FwSectionLabel } from '@f-desk/ui'
import HlText from './HlText.vue'

/** Seção da landing: rótulo numerado, título (h2) com destaque, texto de apoio e conteúdo. */
defineProps<{ id: string; number: number; eyebrow: string; title: string; lead?: string }>()
</script>

<template>
  <section :id="id" class="landing-section" :aria-labelledby="`${id}-titulo`">
    <header class="flex max-w-[64ch] flex-col gap-3">
      <FwSectionLabel :number="number">{{ eyebrow }}</FwSectionLabel>
      <h2 :id="`${id}-titulo`" class="landing-title"><HlText :text="title" /></h2>
      <p v-if="lead" class="m-0 text-lg text-ink-muted">{{ lead }}</p>
    </header>
    <slot />
  </section>
</template>
