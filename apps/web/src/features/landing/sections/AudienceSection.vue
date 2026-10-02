<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'
import LandingSection from '../components/LandingSection.vue'
import { landing } from '../landing-content'

const { audience: content } = landing
</script>

<template>
  <LandingSection
    id="para-quem"
    :number="4"
    :eyebrow="content.eyebrow"
    :title="content.title"
    :lead="content.lead"
  >
    <ul class="grid list-none gap-4 p-0 md:grid-cols-3">
      <li v-for="item in content.items" :key="item.title" class="fw-card fw-principle">
        <FwIcon :name="item.icon" class="fw-card-icon" />
        <h3 class="fw-principle-title m-0">{{ item.title }}</h3>
        <p class="fw-principle-sub m-0">{{ item.text }}</p>
      </li>
    </ul>
  </LandingSection>
</template>
