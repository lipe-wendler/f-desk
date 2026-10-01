<script setup lang="ts">
import { useId } from 'vue'
import FwField from './FwField.vue'
import FwIcon from './FwIcon.vue'
import type { IconName } from './icons'

/** Campo de texto com rótulo, dica/erro e ícone opcional. Use com `v-model`. */
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  id?: string
  label?: string
  hint?: string
  error?: string
  icon?: IconName
  placeholder?: string
}>()
const model = defineModel<string>()
const fieldId = props.id ?? useId()
</script>

<template>
  <FwField :id="fieldId" :label="label" :hint="hint" :error="error">
    <div :class="['fw-control', icon && 'fw-control-icon']">
      <FwIcon v-if="icon" :name="icon" />
      <input
        :id="fieldId"
        v-model="model"
        v-bind="$attrs"
        class="fw-input"
        :placeholder="placeholder"
        :aria-label="label ? undefined : placeholder"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || hint ? `${fieldId}-msg` : undefined"
      />
    </div>
  </FwField>
</template>
