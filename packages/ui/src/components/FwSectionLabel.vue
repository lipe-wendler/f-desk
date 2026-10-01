<script setup lang="ts">
/** Rótulo de seção em CAIXA ALTA (Space Mono), opcionalmente numerado ou com barra amarela. */
defineProps<{ number?: number; bar?: boolean }>()
</script>

<template>
  <div class="fw-eyebrow">
    <span v-if="bar" class="fw-eyebrow-bar" aria-hidden="true" />
    <span v-if="number != null" class="fw-eyebrow-num">{{ String(number).padStart(2, '0') }}</span>
    <span><slot /></span>
  </div>
</template>
