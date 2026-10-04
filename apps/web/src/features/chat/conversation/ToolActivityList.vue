<script setup lang="ts">
import { toolActivityLabel, type ToolActivity } from '@f-desk/shared'
import { FwIcon, type IconName } from '@f-desk/ui'

/**
 * O que a Wen fez com as ferramentas antes de responder ("Consultei seus chamados em aberto (3)",
 * "Preparei o cancelamento do TKT-0042"), como os passos que o Claude mostra. Uma linha por
 * chamada: em andamento enquanto roda, com o resultado depois. Os textos vêm de `toolActivityLabel`.
 */
defineProps<{ tools: ToolActivity[] }>()

const READS = new Set<ToolActivity['tool']>(['listarMeusChamados', 'consultarChamado'])

function icon(activity: ToolActivity): IconName {
  if (activity.status === 'done') return 'check'
  if (activity.status === 'running') return READS.has(activity.tool) ? 'search' : 'inbox'
  return 'alert'
}
</script>

<template>
  <ul class="chat-tools" aria-label="O que a Wen fez" data-testid="tool-activity">
    <li
      v-for="activity in tools"
      :key="activity.id"
      :class="['chat-tool', `chat-tool-${activity.status}`]"
      :aria-busy="activity.status === 'running' || undefined"
    >
      <FwIcon :name="icon(activity)" size="sm" />
      <span>{{ toolActivityLabel(activity) }}</span>
    </li>
  </ul>
</template>
