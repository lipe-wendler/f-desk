<script setup lang="ts">
import { FwIcon, FwInput } from '@f-desk/ui'
import { ref } from 'vue'
import { generatePassword } from '../../lib/password'

/** Senha inicial gerada automaticamente, com "gerar outra" e "copiar". */
defineProps<{ label?: string; error?: string; readonly?: boolean }>()
const model = defineModel<string>({ required: true })
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(model.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <FwInput
      v-model="model"
      :label="label ?? 'Senha inicial'"
      type="password"
      revealable
      autocomplete="new-password"
      :readonly="readonly"
      :error="error"
      hint="Envie para a pessoa por um canal seguro. Ela não é mostrada de novo."
    />
    <div class="flex flex-wrap gap-2">
      <button
        v-if="!readonly"
        type="button"
        class="inline-flex items-center gap-1 text-sm font-semibold text-accent-text hover:underline"
        @click="model = generatePassword()"
      >
        <FwIcon name="key" size="sm" />Gerar outra
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1 text-sm font-semibold text-accent-text hover:underline"
        @click="copy"
      >
        <FwIcon :name="copied ? 'check' : 'copy'" size="sm" />{{
          copied ? 'Copiada' : 'Copiar senha'
        }}
      </button>
    </div>
  </div>
</template>
