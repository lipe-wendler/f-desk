<script setup lang="ts">
import type { TicketChoice } from '@f-desk/shared'
import { FwIcon } from '@f-desk/ui'
import { formatDateTime } from '../../../lib/format'
import TicketStatusTag from '../../tickets/TicketStatusTag.vue'

/**
 * Chamados que a Wen listou, sob a fala dela: a pessoa escolhe um para continuar a conversa sobre
 * ele. Depois da escolha (ou numa fala antiga), a lista fica só para leitura, com o escolhido marcado.
 */
defineProps<{ tickets: TicketChoice[]; chosen?: string; disabled?: boolean }>()
const emit = defineEmits<{ choose: [code: string] }>()
</script>

<template>
  <ul class="chat-options" aria-label="Seus chamados" data-testid="ticket-choices">
    <li v-for="ticket in tickets" :key="ticket.code">
      <button
        type="button"
        class="chat-option chat-ticket-choice"
        :disabled="disabled || Boolean(chosen)"
        :aria-current="chosen === ticket.code || undefined"
        @click="emit('choose', ticket.code)"
      >
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-[12px] tracking-[0.08em] text-ink-muted">
              {{ ticket.code }}
            </span>
            <TicketStatusTag :status="ticket.status" />
          </span>
          <span>{{ ticket.subject }}</span>
          <span class="text-xs font-normal text-ink-muted">
            Aberto em {{ formatDateTime(ticket.createdAt) }}
          </span>
        </span>
        <FwIcon
          :name="chosen === ticket.code ? 'check' : 'arrow-right'"
          size="sm"
          class="flex-none text-ink-muted"
        />
      </button>
    </li>
  </ul>
</template>
