<script setup lang="ts">
import { FwIcon, FwTag } from '@f-desk/ui'
import LandingSection from '../components/LandingSection.vue'
import { landing } from '../landing-content'

const { features: content } = landing
</script>

<template>
  <LandingSection
    id="recursos"
    :number="3"
    :eyebrow="content.eyebrow"
    :title="content.title"
    :lead="content.lead"
  >
    <ul class="grid list-none gap-4 p-0 sm:grid-cols-2">
      <li v-for="item in content.items" :key="item.title" class="fw-card gap-3">
        <FwIcon :name="item.icon" size="lg" class="fw-card-icon" />
        <h3 class="fw-card-title">{{ item.title }}</h3>
        <p class="fw-card-body">{{ item.description }}</p>
        <ul class="mt-auto flex list-none flex-wrap gap-2 p-0 pt-2" aria-label="Inclui">
          <li v-for="tag in item.tags" :key="tag">
            <FwTag size="sm" system>{{ tag }}</FwTag>
          </li>
        </ul>
      </li>
    </ul>
  </LandingSection>
</template>
