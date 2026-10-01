<script setup lang="ts">
/** Radio com rótulo. `v-model` recebe o `value` do item selecionado. */
defineOptions({ inheritAttrs: false })
defineProps<{ label?: string; name: string; value: string }>()
const model = defineModel<string>()
</script>

<template>
  <label class="fw-check">
    <input v-model="model" v-bind="$attrs" type="radio" :name="name" :value="value" />
    <span
      ><slot>{{ label }}</slot></span
    >
  </label>
</template>
