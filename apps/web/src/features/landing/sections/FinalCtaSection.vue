<script setup lang="ts">
import { FwButton } from '@f-desk/ui'
import HlText from '../components/HlText.vue'
import { landing } from '../landing-content'

const { finalCta: content } = landing
</script>

<template>
  <section class="landing-section" aria-labelledby="cta-final-titulo">
    <div class="landing-cta">
      <h2 id="cta-final-titulo" class="landing-title"><HlText :text="content.title" /></h2>
      <p class="m-0 max-w-[52ch] text-lg text-ink-muted">{{ content.lead }}</p>
      <div class="flex flex-wrap justify-center gap-3">
        <FwButton :to="{ name: 'chat' }" size="lg" arrow>{{ content.primary }}</FwButton>
        <FwButton :to="{ name: 'sign-up' }" variant="secondary" size="lg">
          {{ content.secondary }}
        </FwButton>
      </div>
    </div>
  </section>
</template>
