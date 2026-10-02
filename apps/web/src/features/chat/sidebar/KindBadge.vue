<script setup lang="ts">
import { REQUEST_KINDS, type RequestKind } from '@f-desk/shared'
import { computed } from 'vue'

/** Selo do tipo de solicitação (Acesso, Dados, Bug…), com a cor de cada tipo nos dois temas. */
const props = defineProps<{ kind: RequestKind }>()

// Classes escritas por inteiro para o Tailwind encontrar.
const TONES = {
  red: 'bg-kind-red-soft text-kind-red',
  blue: 'bg-kind-blue-soft text-kind-blue',
  purple: 'bg-kind-purple-soft text-kind-purple',
  green: 'bg-kind-green-soft text-kind-green',
  orange: 'bg-kind-orange-soft text-kind-orange',
  pink: 'bg-kind-pink-soft text-kind-pink',
} as const

const info = computed(() => REQUEST_KINDS.find((k) => k.id === props.kind))
</script>

<template>
  <span
    v-if="info"
    :class="[
      'inline-flex flex-none items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold',
      TONES[info.tone],
    ]"
    >{{ info.label }}</span
  >
</template>
