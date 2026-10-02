<script setup lang="ts">
import { landing } from '../landing-content'

const { proof } = landing
</script>

<template>
  <section class="landing-section" aria-labelledby="numeros-titulo">
    <h2 id="numeros-titulo" class="sr-only">{{ proof.title }}</h2>
    <ul class="grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-4">
      <li v-for="item in proof.items" :key="item.value" class="fw-card">
        <span class="fw-metric-value">{{ item.value }}</span>
        <span class="fw-metric-bar" aria-hidden="true" />
        <span class="mt-2 text-sm text-ink-muted">{{ item.label }}</span>
      </li>
    </ul>
  </section>
</template>
