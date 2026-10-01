<script setup lang="ts">
import FwIcon from './FwIcon.vue'
import type { IconName } from './icons'

/** Card com ícone de destaque, kicker, título, descrição e ação opcional (slot `action`). */
withDefaults(
  defineProps<{ title: string; description?: string; icon?: IconName; kicker?: string }>(),
  {
    icon: 'box',
    kicker: 'Feature',
  },
)
</script>

<template>
  <article class="fw-card">
    <FwIcon :name="icon" size="lg" class="fw-card-icon" />
    <div class="fw-card-kicker" style="margin-top: var(--space-2)">{{ kicker }}</div>
    <h3 class="fw-card-title">{{ title }}</h3>
    <p v-if="description" class="fw-card-body">{{ description }}</p>
    <div v-if="$slots.action" class="fw-card-foot"><slot name="action" /></div>
  </article>
</template>
