<script setup lang="ts">
import FwIcon from './FwIcon.vue'

/** Moldura de campo: rótulo, controle (slot) e dica ou erro ligados por `id`. */
defineProps<{ id: string; label?: string; hint?: string; error?: string }>()
</script>

<template>
  <div class="fw-field">
    <label v-if="label" class="fw-field-label" :for="id">{{ label }}</label>
    <slot />
    <span v-if="error" :id="`${id}-msg`" class="fw-field-error">
      <FwIcon name="alert" size="sm" />{{ error }}
    </span>
    <span v-else-if="hint" :id="`${id}-msg`" class="fw-field-hint">{{ hint }}</span>
  </div>
</template>
