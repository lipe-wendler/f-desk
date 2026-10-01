<script setup lang="ts">
import FwIcon from './FwIcon.vue'
import type { IconName } from './icons'

/** Botão circular só com ícone; `label` é obrigatório (vira aria-label e title). */
withDefaults(
  defineProps<{
    icon: IconName
    label: string
    tone?: 'neutral' | 'accent'
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { tone: 'neutral', size: 'md' },
)
</script>

<template>
  <button
    type="button"
    :class="[
      'fw-iconbtn',
      tone === 'accent' && 'fw-iconbtn-accent',
      size !== 'md' && `fw-iconbtn-${size}`,
    ]"
    :aria-label="label"
    :title="label"
  >
    <FwIcon :name="icon" />
  </button>
</template>
