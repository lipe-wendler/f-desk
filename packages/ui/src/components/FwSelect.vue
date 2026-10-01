<script setup lang="ts">
import { computed, useId } from 'vue'
import FwField from './FwField.vue'
import FwIcon from './FwIcon.vue'

type Option = string | { value: string; label: string }

/** Select nativo com o visual da marca. Use com `v-model`. */
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  id?: string
  label?: string
  hint?: string
  error?: string
  options: Option[]
  placeholder?: string
}>()
const model = defineModel<string>({ default: '' })
const fieldId = props.id ?? useId()
const items = computed(() =>
  props.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
)
</script>

<template>
  <FwField :id="fieldId" :label="label" :hint="hint" :error="error">
    <div class="fw-control fw-control-select">
      <select
        :id="fieldId"
        v-model="model"
        v-bind="$attrs"
        class="fw-select"
        :aria-label="label ? undefined : placeholder"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || hint ? `${fieldId}-msg` : undefined"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="item in items" :key="item.value" :value="item.value">
          {{ item.label }}
        </option>
      </select>
      <FwIcon name="chevron-down" />
    </div>
  </FwField>
</template>
