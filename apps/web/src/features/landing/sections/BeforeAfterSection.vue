<script setup lang="ts">
import LandingSection from '../components/LandingSection.vue'
import { landing } from '../landing-content'

const { beforeAfter: content } = landing
const rows = ['problem', 'solution', 'result'] as const
</script>

<template>
  <LandingSection
    id="antes-e-depois"
    :number="1"
    :eyebrow="content.eyebrow"
    :title="content.title"
    :lead="content.lead"
  >
    <ul class="grid list-none gap-4 p-0 lg:grid-cols-3">
      <li v-for="item in content.items" :key="item.title" class="fw-card gap-4">
        <h3 class="fw-card-title">{{ item.title }}</h3>
        <dl class="m-0 flex flex-col gap-3">
          <div v-for="row in rows" :key="row" class="flex flex-col gap-1">
            <dt class="landing-label" :class="{ 'text-accent-text': row === 'result' }">
              {{ content.labels[row] }}
            </dt>
            <dd
              class="m-0 text-sm"
              :class="row === 'result' ? 'font-semibold text-ink' : 'text-ink-muted'"
            >
              {{ item[row] }}
            </dd>
          </div>
        </dl>
      </li>
    </ul>
  </LandingSection>
</template>
