<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'

type Item = string | { value: string; label: string }

/** Controle segmentado em pílula. `v-model` com o valor da aba ativa; setas ←/→ navegam. */
const props = withDefaults(
  defineProps<{ items: Item[]; variant?: 'accent' | 'neutral'; label?: string }>(),
  {
    variant: 'accent',
  },
)
const tabs = computed(() =>
  props.items.map((i) => (typeof i === 'string' ? { value: i, label: i } : i)),
)
const model = defineModel<string>()
const active = computed(() => model.value ?? tabs.value[0]?.value)
const buttons = useTemplateRef<HTMLButtonElement[]>('buttons')

async function move(from: number, delta: number) {
  const next = (from + delta + tabs.value.length) % tabs.value.length
  model.value = tabs.value[next]!.value
  await nextTick()
  buttons.value?.[next]?.focus()
}
</script>

<template>
  <div role="tablist" :aria-label="label" :class="['fw-tabs', `fw-tabs-${variant}`]">
    <button
      v-for="(tab, i) in tabs"
      :key="tab.value"
      ref="buttons"
      role="tab"
      type="button"
      class="fw-tab"
      :aria-selected="tab.value === active ? 'true' : 'false'"
      :tabindex="tab.value === active ? 0 : -1"
      @click="model = tab.value"
      @keydown.right.prevent="move(i, 1)"
      @keydown.left.prevent="move(i, -1)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
