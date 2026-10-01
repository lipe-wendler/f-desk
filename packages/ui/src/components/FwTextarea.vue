<script setup lang="ts">
import { useId } from 'vue'
import FwField from './FwField.vue'

/** Área de texto com contador opcional (`maxLength`). Use com `v-model`. */
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  id?: string
  label?: string
  hint?: string
  error?: string
  maxLength?: number
  placeholder?: string
}>()
const model = defineModel<string>({ default: '' })
const fieldId = props.id ?? useId()
</script>

<template>
  <FwField :id="fieldId" :label="label" :hint="hint" :error="error">
    <div class="fw-control">
      <textarea
        :id="fieldId"
        v-model="model"
        v-bind="$attrs"
        class="fw-textarea"
        :maxlength="maxLength"
        :placeholder="placeholder"
        :aria-label="label ? undefined : placeholder"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || hint ? `${fieldId}-msg` : undefined"
      />
      <span v-if="maxLength" class="fw-counter" aria-live="polite"
        >{{ model.length }}/{{ maxLength }}</span
      >
    </div>
  </FwField>
</template>
