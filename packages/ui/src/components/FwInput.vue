<script setup lang="ts">
import { computed, ref, useAttrs, useId } from 'vue'
import FwField from './FwField.vue'
import FwIcon from './FwIcon.vue'
import type { IconName } from './icons'

/**
 * Campo de texto com rótulo, dica/erro e ícone opcional. Use com `v-model`.
 * Com `type="password"` e `revealable`, ganha um botão para mostrar/ocultar a senha.
 */
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  id?: string
  label?: string
  hint?: string
  error?: string
  icon?: IconName
  placeholder?: string
  revealable?: boolean
}>()
const model = defineModel<string>()
const attrs = useAttrs()
const fieldId = props.id ?? useId()

const revealed = ref(false)
const canReveal = computed(() => props.revealable && attrs.type === 'password')
const inputType = computed(() => (canReveal.value && revealed.value ? 'text' : attrs.type))
</script>

<template>
  <FwField :id="fieldId" :label="label" :hint="hint" :error="error">
    <div :class="['fw-control', icon && 'fw-control-icon', canReveal && 'fw-control-reveal']">
      <FwIcon v-if="icon" :name="icon" />
      <input
        :id="fieldId"
        v-model="model"
        v-bind="$attrs"
        :type="inputType as string"
        class="fw-input"
        :placeholder="placeholder"
        :aria-label="label ? undefined : placeholder"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || hint ? `${fieldId}-msg` : undefined"
      />
      <button
        v-if="canReveal"
        type="button"
        class="fw-reveal"
        :aria-label="revealed ? 'Ocultar senha' : 'Mostrar senha'"
        :aria-pressed="revealed ? 'true' : 'false'"
        :aria-controls="fieldId"
        @click="revealed = !revealed"
      >
        <FwIcon :name="revealed ? 'eye-off' : 'eye'" />
      </button>
    </div>
  </FwField>
</template>
