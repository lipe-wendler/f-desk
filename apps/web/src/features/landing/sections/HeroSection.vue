<script setup lang="ts">
import { FwButton, FwSectionLabel } from '@f-desk/ui'
import AnchorLink from '../components/AnchorLink.vue'
import ChatPreview from '../components/ChatPreview.vue'
import HlText from '../components/HlText.vue'
import WordsMarquee from '../components/WordsMarquee.vue'
import { landing } from '../landing-content'

const { hero, words } = landing
</script>

<template>
  <section class="landing-hero" aria-labelledby="hero-titulo">
    <div class="landing-hero-copy">
      <FwSectionLabel bar>{{ hero.eyebrow }}</FwSectionLabel>
      <h1 id="hero-titulo" class="landing-hero-title">
        <template v-for="line in hero.manifesto" :key="line">
          <span class="block"><HlText :text="line" /></span>
        </template>
      </h1>
      <p class="m-0 max-w-[52ch] text-lg text-ink-muted">{{ hero.summary }}</p>
      <div class="flex flex-wrap gap-3">
        <FwButton :to="{ name: 'chat' }" size="lg" arrow>{{ hero.primary }}</FwButton>
        <AnchorLink target="planos" class="fw-btn fw-btn-secondary fw-btn-lg">
          {{ hero.secondary }}
        </AnchorLink>
      </div>
    </div>
    <ChatPreview :label="hero.previewLabel" class="landing-hero-art" />
    <WordsMarquee :words="words" class="landing-hero-words" />
  </section>
</template>
