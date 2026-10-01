<script setup lang="ts">
/** Checkbox com rótulo. `v-model` booleano. */
defineOptions({ inheritAttrs: false })
defineProps<{ label?: string }>()
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="fw-check">
    <input v-model="model" v-bind="$attrs" type="checkbox" />
    <span
      ><slot>{{ label }}</slot></span
    >
  </label>
</template>
