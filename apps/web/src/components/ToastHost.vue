<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div
    class="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto"
    aria-live="polite"
    role="status"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto flex max-w-sm items-center gap-2 rounded-md border border-line bg-surface-raised px-4 py-3 text-sm text-ink shadow-pop"
    >
      <FwIcon
        :name="toast.tone === 'success' ? 'check' : 'alert'"
        size="sm"
        :class="toast.tone === 'success' ? 'text-success' : 'text-danger'"
      />
      <span class="flex-1">{{ toast.message }}</span>
      <button
        type="button"
        class="text-ink-muted hover:text-ink"
        aria-label="Fechar aviso"
        @click="dismiss(toast.id)"
      >
        <FwIcon name="close" size="sm" />
      </button>
    </div>
  </div>
</template>
