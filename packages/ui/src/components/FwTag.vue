<script setup lang="ts">
/** Pílula para tecnologia, tópicos, status e filtros. Com `clickable` vira botão de alternância. */
defineProps<{ size?: 'sm'; selected?: boolean; system?: boolean; clickable?: boolean }>()
defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    v-if="clickable"
    type="button"
    :class="['fw-tag', size === 'sm' && 'fw-tag-sm', system && 'fw-tag-system']"
    :aria-pressed="selected ? 'true' : 'false'"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
  <span
    v-else
    :class="[
      'fw-tag',
      size === 'sm' && 'fw-tag-sm',
      system && 'fw-tag-system',
      selected && 'fw-tag-selected',
    ]"
  >
    <slot />
  </span>
</template>
