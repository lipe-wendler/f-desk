<script setup lang="ts">
import {
  TICKET_MESSAGE_MAX,
  TICKET_PRIORITY_LABEL,
  ticketMessageSchema,
  type TicketDetail,
} from '@f-desk/shared'
import { FwButton, FwDialog, FwSectionLabel, FwTextarea } from '@f-desk/ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import FormAlert from '../../components/FormAlert.vue'
import { useToast } from '../../composables/useToast'
import { formatDateTime } from '../../lib/format'
import { ticketsApi } from './tickets-api'
import TicketStatusTag from './TicketStatusTag.vue'
import TranscriptView from './TranscriptView.vue'

/** Chamado do cliente: andamento, conversa com a equipe, resposta e encerramento. */
const route = useRoute()
const { show } = useToast()

const ticket = ref<TicketDetail | null>(null)
const loadError = ref('')
const reply = ref('')
const replyError = ref('')
const sending = ref(false)
const confirmClose = ref(false)
const closing = ref(false)

const code = computed(() => String(route.params.id))
const isClosed = computed(() => ticket.value?.status === 'closed')

const STATUS_HINT: Record<TicketDetail['status'], string> = {
  open: 'Recebido. Um técnico vai assumir o seu chamado.',
  in_progress: 'Um técnico está cuidando do seu chamado.',
  waiting_client: 'O técnico precisa de uma resposta sua para continuar.',
  resolved: 'O técnico marcou como resolvido. Se o problema voltou, responda abaixo para reabrir.',
  closed: 'Chamado encerrado. Se precisar de ajuda de novo, abra um novo chamado.',
}

async function load() {
  const result = await ticketsApi.get(code.value)
  if (result.error !== null) {
    loadError.value = result.status === 404 ? 'Chamado não encontrado.' : result.error
    ticket.value = null
    return
  }
  loadError.value = ''
  ticket.value = result.data
}

async function send() {
  const parsed = ticketMessageSchema.safeParse({ content: reply.value })
  if (!parsed.success) {
    replyError.value = parsed.error.issues[0]?.message ?? 'Confira a mensagem.'
    return
  }
  sending.value = true
  const result = await ticketsApi.reply(code.value, parsed.data.content)
  sending.value = false
  if (result.error !== null) {
    replyError.value = result.error
    return
  }
  reply.value = ''
  replyError.value = ''
  await load()
}

async function close() {
  closing.value = true
  const result = await ticketsApi.close(code.value)
  closing.value = false
  confirmClose.value = false
  if (result.error !== null) {
    show(result.error, 'danger')
    return
  }
  show(`Chamado ${code.value} encerrado.`)
  await load()
}

watch(reply, () => (replyError.value = ''))
watch(code, load, { immediate: true })
</script>

<template>
  <FormAlert v-if="loadError">{{ loadError }}</FormAlert>
  <p v-else-if="!ticket" class="m-0 text-ink-muted">Carregando…</p>
  <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <section
      class="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8"
    >
      <div class="flex flex-col gap-3">
        <FwSectionLabel bar>{{ ticket.code }}</FwSectionLabel>
        <h1 class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em]">
          {{ ticket.subject }}
        </h1>
        <div class="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          <TicketStatusTag :status="ticket.status" />
          <span>Prioridade {{ TICKET_PRIORITY_LABEL[ticket.priority].toLowerCase() }}</span>
          <span>Aberto em {{ formatDateTime(ticket.createdAt) }}</span>
          <span v-if="ticket.assigneeName">Técnico: {{ ticket.assigneeName }}</span>
        </div>
        <p class="m-0 text-sm" data-testid="status-hint">{{ STATUS_HINT[ticket.status] }}</p>
      </div>

      <ol class="m-0 flex list-none flex-col gap-4 p-0" data-testid="thread">
        <li class="flex flex-col items-end gap-1">
          <span class="font-mono text-[12px] tracking-[0.16em] text-ink-muted uppercase">
            Você · {{ formatDateTime(ticket.createdAt) }}
          </span>
          <p class="m-0 max-w-[60ch] rounded-lg bg-surface-raised px-4 py-3 whitespace-pre-line">
            {{ ticket.description }}
          </p>
        </li>
        <li
          v-for="m in ticket.messages"
          :key="m.id"
          :class="['flex flex-col gap-1', m.author.fromClient ? 'items-end' : 'items-start']"
        >
          <span class="font-mono text-[12px] tracking-[0.16em] text-ink-muted uppercase">
            {{ m.author.fromClient ? 'Você' : m.author.name }} · {{ formatDateTime(m.createdAt) }}
          </span>
          <p
            :class="[
              'm-0 max-w-[60ch] rounded-lg px-4 py-3 whitespace-pre-line',
              m.author.fromClient ? 'bg-surface-raised' : 'border border-line',
            ]"
          >
            {{ m.content }}
          </p>
        </li>
      </ol>

      <form v-if="!isClosed" class="flex flex-col gap-3" novalidate @submit.prevent="send">
        <FwTextarea
          v-model="reply"
          label="Responder"
          :placeholder="
            ticket.status === 'resolved'
              ? 'O problema voltou? Conte o que aconteceu…'
              : 'Escreva sua mensagem…'
          "
          :max-length="TICKET_MESSAGE_MAX"
          :error="replyError || undefined"
          rows="4"
        />
        <div class="flex flex-wrap justify-end gap-2">
          <FwButton variant="ghost" @click="confirmClose = true">Encerrar chamado</FwButton>
          <FwButton type="submit" arrow :disabled="sending || !reply.trim()">
            {{ sending ? 'Enviando…' : 'Enviar' }}
          </FwButton>
        </div>
      </form>
    </section>

    <aside class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-card">
      <FwSectionLabel>Conversa com a Wen</FwSectionLabel>
      <div v-if="ticket.transcript.length" class="max-h-[70vh] overflow-y-auto pr-1">
        <TranscriptView :messages="ticket.transcript" />
      </div>
      <p v-else class="m-0 text-sm text-ink-muted">Nenhuma conversa anexada a este chamado.</p>
      <FwButton :to="{ name: 'tickets' }" variant="secondary">Voltar aos chamados</FwButton>
    </aside>

    <FwDialog
      v-model:open="confirmClose"
      size="sm"
      title="Encerrar chamado"
      description="Encerre quando o problema estiver resolvido ou se não precisar mais de ajuda. Um chamado encerrado não recebe novas respostas."
    >
      <template #footer>
        <FwButton variant="ghost" @click="confirmClose = false">Cancelar</FwButton>
        <FwButton :disabled="closing" @click="close">Encerrar</FwButton>
      </template>
    </FwDialog>
  </div>
</template>
