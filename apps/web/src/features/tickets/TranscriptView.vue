<script setup lang="ts">
import type { TranscriptMessage } from '@f-desk/shared'

/** Conversa com a Wen, em modo leitura (anexada ao chamado ou no histórico). */
defineProps<{ messages: TranscriptMessage[] }>()
</script>

<template>
  <ol class="m-0 flex list-none flex-col gap-3 p-0">
    <li
      v-for="(m, i) in messages"
      :key="i"
      :class="['flex flex-col gap-1', m.role === 'user' ? 'items-end' : 'items-start']"
    >
      <span class="font-mono text-[12px] tracking-[0.16em] text-ink-muted uppercase">
        {{ m.role === 'user' ? 'Cliente' : 'Wen' }}
        <template v-if="m.source === 'faq'"> · resposta pronta</template>
      </span>
      <p
        :class="[
          'm-0 max-w-[60ch] rounded-lg px-4 py-3 text-sm whitespace-pre-line',
          m.role === 'user' ? 'bg-surface-raised' : 'border border-line',
        ]"
      >
        {{ m.content }}
      </p>
    </li>
  </ol>
</template>
