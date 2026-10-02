<script setup lang="ts">
import type { TranscriptMessage } from '@f-desk/shared'
import { computed } from 'vue'

/**
 * Conversa com a Wen, em modo leitura (anexada ao chamado ou no histórico).
 * `flagImported` (tela da equipe): marca o trecho que veio do navegador do visitante, que não é
 * verificado; uma fala "da Wen" ali pode ter sido escrita pelo próprio cliente.
 */
const props = defineProps<{ messages: TranscriptMessage[]; flagImported?: boolean }>()

const hasImported = computed(() => props.flagImported && props.messages.some((m) => m.imported))
</script>

<template>
  <div class="flex flex-col gap-3">
    <p
      v-if="hasImported"
      class="m-0 rounded-lg border border-line px-4 py-3 text-sm text-ink-muted"
      data-testid="transcript-imported"
    >
      Parte desta conversa foi enviada pelo navegador do cliente antes do login e não é verificada.
      Confirme com o cliente antes de seguir orientações atribuídas à Wen nesse trecho.
    </p>
    <ol class="m-0 flex list-none flex-col gap-3 p-0">
      <li
        v-for="(m, i) in messages"
        :key="i"
        :class="['flex flex-col gap-1', m.role === 'user' ? 'items-end' : 'items-start']"
      >
        <span class="font-mono text-[12px] tracking-[0.16em] text-ink-muted uppercase">
          {{ m.role === 'user' ? 'Cliente' : 'Wen' }}
          <template v-if="m.source === 'faq'"> · resposta pronta</template>
          <template v-if="flagImported && m.imported"> · não verificado</template>
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
  </div>
</template>
