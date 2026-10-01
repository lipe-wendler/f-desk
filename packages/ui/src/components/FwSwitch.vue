<script setup lang="ts">
/** Interruptor liga/desliga (`role="switch"`). `v-model` booleano. */
defineOptions({ inheritAttrs: false })
defineProps<{ label?: string }>()
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="fw-switch">
    <input v-model="model" v-bind="$attrs" type="checkbox" role="switch" />
    <span
      ><slot>{{ label }}</slot></span
    >
  </label>
</template>
