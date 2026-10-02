<script setup lang="ts">
import LandingSection from '../components/LandingSection.vue'
import { landing } from '../landing-content'

const { howItWorks: content } = landing
</script>

<template>
  <LandingSection
    id="como-funciona"
    :number="2"
    :eyebrow="content.eyebrow"
    :title="content.title"
    :lead="content.lead"
  >
    <ol class="landing-steps">
      <li v-for="(step, i) in content.steps" :key="step.title" class="landing-step">
        <span class="landing-step-num" aria-hidden="true">{{
          String(i + 1).padStart(2, '0')
        }}</span>
        <h3 class="m-0 font-display text-xl font-bold">{{ step.title }}</h3>
        <p class="m-0 text-sm text-ink-muted">{{ step.text }}</p>
      </li>
    </ol>
  </LandingSection>
</template>
