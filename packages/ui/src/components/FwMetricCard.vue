<script setup lang="ts">
import FwIcon from './FwIcon.vue'
import type { IconName } from './icons'

/** Card de métrica: número grande em Urbanist, rótulo e barra amarela. */
withDefaults(
  defineProps<{ value: string | number; label: string; icon?: IconName; kicker?: string }>(),
  {
    icon: 'bar-chart',
    kicker: 'Metric',
  },
)
</script>

<template>
  <article class="fw-card">
    <FwIcon :name="icon" size="lg" class="fw-card-icon" />
    <div class="fw-card-kicker" style="margin-top: var(--space-2)">{{ kicker }}</div>
    <div class="fw-metric-value">{{ value }}</div>
    <p class="fw-card-body">{{ label }}</p>
    <span class="fw-metric-bar" aria-hidden="true" />
  </article>
</template>
