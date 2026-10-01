<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from './icons'

/** Ícone de traço 24×24 que herda `currentColor`. Com `label` vira `role="img"`. */
const props = defineProps<{ name: IconName; size?: 'sm' | 'lg'; label?: string }>()
const paths = computed(() => ICONS[props.name] ?? ICONS.box)
</script>

<template>
  <svg
    :class="['fw-icon', size && `fw-icon-${size}`]"
    viewBox="0 0 24 24"
    :aria-hidden="label ? undefined : 'true'"
    :role="label ? 'img' : undefined"
    :aria-label="label"
  >
    <path v-for="d in paths" :key="d" :d="d" />
  </svg>
</template>
