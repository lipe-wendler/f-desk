<script setup lang="ts">
import { computed, nextTick, useId, useTemplateRef, watch } from 'vue'

/**
 * Barra de envio do atendimento: um cartão com o campo (uma linha que cresce até 30% da tela) e o
 * botão "Enviar ↵" dentro. Enter envia; Shift+Enter quebra a linha. O contador só aparece perto do
 * limite, e o erro fica logo abaixo, ligado ao campo.
 */
const props = defineProps<{ maxLength: number; sending?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [] }>()
const model = defineModel<string>({ default: '' })

const id = useId()
const field = useTemplateRef<HTMLTextAreaElement>('field')
const canSend = computed(() => !props.sending && model.value.trim().length > 0)
/** A partir de 80% do limite o contador aparece. */
const showCounter = computed(() => model.value.length >= props.maxLength * 0.8)

function resize() {
  const el = field.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
watch(model, () => nextTick(resize))

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    if (canSend.value) emit('submit')
  }
}

defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="chat-composer-box" :class="{ 'is-invalid': error }">
      <label :for="id" class="sr-only">Sua mensagem</label>
      <textarea
        :id="id"
        ref="field"
        v-model="model"
        rows="1"
        class="chat-composer-field"
        placeholder="Descreva sua dúvida ou o que aconteceu…"
        :maxlength="maxLength"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${id}-erro` : `${id}-dica`"
        @keydown="onKeydown"
      />
      <span v-if="showCounter" class="chat-composer-counter" aria-live="polite">
        {{ model.length }}/{{ maxLength }}
      </span>
      <button type="button" class="chat-composer-send" :disabled="!canSend" @click="emit('submit')">
        {{ sending ? 'Respondendo…' : 'Enviar' }}
        <kbd aria-hidden="true">↵</kbd>
      </button>
    </div>
    <p v-if="error" :id="`${id}-erro`" class="m-0 text-xs text-danger" role="alert">
      {{ error }}
    </p>
    <p :id="`${id}-dica`" class="m-0 px-1 font-mono text-[11px] text-ink-muted">
      Enter para enviar<span class="max-sm:hidden"> · Shift + Enter para nova linha</span> · não
      compartilhe senhas
    </p>
  </div>
</template>
