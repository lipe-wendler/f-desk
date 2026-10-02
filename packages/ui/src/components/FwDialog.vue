<script setup lang="ts">
import { onBeforeUnmount, useId, useTemplateRef, watch } from 'vue'
import FwIcon from './FwIcon.vue'

/**
 * Modal sobre o `<dialog>` nativo: prende o foco, fecha com Esc e com clique no fundo.
 * Use com `v-model:open`. Slots: padrão (conteúdo) e `footer` (ações).
 */
defineProps<{ title: string; description?: string; size?: 'sm' | 'md' }>()
const open = defineModel<boolean>('open', { default: false })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
const descriptionId = useId()

function sync(value: boolean) {
  const el = dialog.value
  if (!el) return
  if (value && !el.open) {
    if (typeof el.showModal === 'function') el.showModal()
    else el.setAttribute('open', '')
  } else if (!value && el.open) {
    if (typeof el.close === 'function') el.close()
    else el.removeAttribute('open')
  }
}

watch(open, sync, { flush: 'post' })
watch(dialog, () => sync(open.value))
onBeforeUnmount(() => sync(false))

function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false
}
</script>

<template>
  <dialog
    ref="dialog"
    :class="['fw-dialog', size === 'sm' && 'fw-dialog-sm']"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descriptionId : undefined"
    @cancel.prevent="open = false"
    @click="onBackdrop"
  >
    <div class="fw-dialog-panel">
      <header class="fw-dialog-head">
        <div class="fw-dialog-titles">
          <h2 :id="titleId" class="fw-dialog-title">{{ title }}</h2>
          <p v-if="description" :id="descriptionId" class="fw-dialog-desc">{{ description }}</p>
        </div>
        <button type="button" class="fw-dialog-close" aria-label="Fechar" @click="open = false">
          <FwIcon name="close" />
        </button>
      </header>
      <div class="fw-dialog-body"><slot /></div>
      <footer v-if="$slots.footer" class="fw-dialog-foot"><slot name="footer" /></footer>
    </div>
  </dialog>
</template>
