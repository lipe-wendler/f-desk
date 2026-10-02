<script setup lang="ts">
import { computed } from 'vue'
import { splitHighlight } from '../highlight'

/** Texto com `*trecho*` em destaque amarelo (`fw-hl`). */
const props = defineProps<{ text: string }>()
const parts = computed(() => splitHighlight(props.text))
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <span v-if="part.hl" class="fw-hl">{{ part.text }}</span>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
