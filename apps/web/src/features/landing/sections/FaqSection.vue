<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'
import LandingSection from '../components/LandingSection.vue'
import { landing } from '../landing-content'

const { faq: content } = landing
</script>

<template>
  <LandingSection id="duvidas" :number="6" :eyebrow="content.eyebrow" :title="content.title">
    <div class="landing-faq">
      <details v-for="item in content.items" :key="item.question" class="landing-faq-item">
        <summary>
          <span>{{ item.question }}</span>
          <FwIcon name="chevron-down" size="sm" class="landing-faq-icon" />
        </summary>
        <p class="m-0 text-ink-muted">{{ item.answer }}</p>
      </details>
    </div>
  </LandingSection>
</template>
