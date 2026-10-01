<script setup lang="ts">
import FwIcon from './FwIcon.vue'

/** Linha de etapas numeradas; `current` é o índice (0-based) da etapa atual. */
withDefaults(
  defineProps<{ steps: { title: string; description?: string }[]; current?: number }>(),
  {
    current: 0,
  },
)
const stateOf = (i: number, current: number) =>
  i < current ? 'done' : i === current ? 'current' : 'todo'
</script>

<template>
  <ol class="fw-stepper">
    <li
      v-for="(step, i) in steps"
      :key="step.title"
      :class="['fw-step', `fw-step-${stateOf(i, current)}`]"
      :aria-current="i === current ? 'step' : undefined"
    >
      <span class="fw-step-dot">
        <FwIcon v-if="i < current" name="check" size="sm" />
        <template v-else>{{ String(i + 1).padStart(2, '0') }}</template>
      </span>
      <span class="fw-step-title">{{ step.title }}</span>
      <span v-if="step.description" class="fw-step-sub">{{ step.description }}</span>
    </li>
  </ol>
</template>
