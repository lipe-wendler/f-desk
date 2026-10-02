<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'

/** Opções do atendimento guiado sob a fala do Wen: cada linha é um botão. */
defineProps<{ options: { id: string; label: string }[]; disabled?: boolean; label: string }>()
const emit = defineEmits<{ choose: [id: string] }>()
</script>

<template>
  <ul class="chat-options" :aria-label="label">
    <li v-for="option in options" :key="option.id">
      <button
        type="button"
        class="chat-option"
        :disabled="disabled"
        @click="emit('choose', option.id)"
      >
        <span class="min-w-0 flex-1">{{ option.label }}</span>
        <FwIcon name="arrow-right" size="sm" class="flex-none text-ink-muted" />
      </button>
    </li>
  </ul>
</template>
