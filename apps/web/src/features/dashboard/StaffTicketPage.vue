<script setup lang="ts">
import {
  TICKET_MESSAGE_MAX,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TRANSITIONS,
  ticketMessageSchema,
  type Assignee,
  type StaffTicketDetail,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketInput,
} from '@f-desk/shared'
import { FwButton, FwCheckbox, FwSectionLabel, FwSelect, FwTextarea } from '@f-desk/ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import FormAlert from '../../components/FormAlert.vue'
import { useToast } from '../../composables/useToast'
import { formatDateTime } from '../../lib/format'
import { useSessionStore } from '../../stores/session'
import TicketStatusTag from '../tickets/TicketStatusTag.vue'
import TranscriptView from '../tickets/TranscriptView.vue'
import { staffApi } from './staff-api'

/** Atendimento do chamado: status, prioridade, responsável, conversa com o cliente e notas internas. */
const route = useRoute()
const session = useSessionStore()
const { show } = useToast()

const ticket = ref<StaffTicketDetail | null>(null)
const assignees = ref<Assignee[]>([])
const loadError = ref('')
const reply = ref('')
const internal = ref(false)
const replyError = ref('')
const sending = ref(false)
const saving = ref(false)

const code = computed(() => String(route.params.id))
const isClosed = computed(() => ticket.value?.status === 'closed')
const isMine = computed(() => ticket.value?.assignee?.id === session.user?.id)

const statusOptions = computed(() => {
  const current = ticket.value?.status
  if (!current) return []
  return [current, ...TICKET_STATUS_TRANSITIONS[current]].map((s) => ({
    value: s,
    label: TICKET_STATUS_LABEL[s],
  }))
})
const priorityOptions = [...TICKET_PRIORITIES]
  .reverse()
  .map((p) => ({ value: p, label: TICKET_PRIORITY_LABEL[p] }))
const assigneeOptions = computed(() => [
  { value: '', label: 'Sem responsável' },
  ...assignees.value.map((a) => ({
    value: a.id,
    label: a.id === session.user?.id ? `${a.name} (você)` : a.name,
  })),
])

async function load() {
  const result = await staffApi.get(code.value)
  if (result.error !== null) {
    loadError.value = result.status === 404 ? 'Chamado não encontrado.' : result.error
    ticket.value = null
    return
  }
  loadError.value = ''
  ticket.value = result.data
}

async function update(input: UpdateTicketInput, done: string) {
  saving.value = true
  const result = await staffApi.update(code.value, input)
  saving.value = false
  if (result.error !== null) show(result.error, 'danger')
  else show(done)
  await load()
}

const onStatus = (value: string) =>
  value !== ticket.value?.status &&
  update(
    { status: value as TicketStatus },
    `Status: ${TICKET_STATUS_LABEL[value as TicketStatus]}.`,
  )
const onPriority = (value: string) =>
  value !== ticket.value?.priority &&
  update(
    { priority: value as TicketPriority },
    `Prioridade: ${TICKET_PRIORITY_LABEL[value as TicketPriority].toLowerCase()}.`,
  )
const onAssignee = (value: string) =>
  value !== (ticket.value?.assignee?.id ?? '') &&
  update(
    { assigneeId: value || null },
    value ? 'Responsável alterado.' : 'Chamado sem responsável.',
  )

async function send() {
  const parsed = ticketMessageSchema.safeParse({ content: reply.value, internal: internal.value })
  if (!parsed.success) {
    replyError.value = parsed.error.issues[0]?.message ?? 'Confira a mensagem.'
    return
  }
  sending.value = true
  const result = await staffApi.reply(code.value, parsed.data.content, parsed.data.internal)
  sending.value = false
  if (result.error !== null) {
    replyError.value = result.error
    return
  }
  show(parsed.data.internal ? 'Nota interna adicionada.' : 'Resposta enviada ao cliente.')
  reply.value = ''
  internal.value = false
  await load()
}

watch(reply, () => (replyError.value = ''))
watch(code, load, { immediate: true })
void staffApi.assignees().then((r) => {
  if (r.error === null) assignees.value = r.data.assignees
})
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
          <span>{{ ticket.client.name }} · {{ ticket.client.email }}</span>
          <span>Aberto em {{ formatDateTime(ticket.createdAt) }}</span>
        </div>
      </div>

      <ol class="m-0 flex list-none flex-col gap-4 p-0" data-testid="thread">
        <li class="flex flex-col items-start gap-1">
          <span class="font-mono text-[12px] tracking-[0.16em] text-ink-muted uppercase">
            {{ ticket.client.name }} · {{ formatDateTime(ticket.createdAt) }}
          </span>
          <p class="m-0 max-w-[60ch] rounded-lg border border-line px-4 py-3 whitespace-pre-line">
            {{ ticket.description }}
          </p>
        </li>
        <li
          v-for="m in ticket.messages"
          :key="m.id"
          :class="['flex flex-col gap-1', m.author.role === 'client' ? 'items-start' : 'items-end']"
        >
          <span class="font-mono text-[12px] tracking-[0.16em] text-ink-muted uppercase">
            <template v-if="m.internal">Nota interna · </template>{{ m.author.name }} ·
            {{ formatDateTime(m.createdAt) }}
          </span>
          <p
            :class="[
              'm-0 max-w-[60ch] rounded-lg px-4 py-3 whitespace-pre-line',
              m.internal
                ? 'border border-dashed border-accent bg-accent-soft'
                : m.author.role === 'client'
                  ? 'border border-line'
                  : 'bg-surface-raised',
            ]"
          >
            {{ m.content }}
          </p>
        </li>
      </ol>

      <form v-if="!isClosed" class="flex flex-col gap-3" novalidate @submit.prevent="send">
        <FwTextarea
          v-model="reply"
          :label="internal ? 'Nota interna' : 'Responder ao cliente'"
          :placeholder="internal ? 'Só a equipe vê esta nota…' : 'Escreva a resposta…'"
          :max-length="TICKET_MESSAGE_MAX"
          :error="replyError || undefined"
          rows="4"
        />
        <div class="flex flex-wrap items-center justify-between gap-3">
          <FwCheckbox v-model="internal" label="Nota interna (só a equipe vê)" />
          <FwButton type="submit" arrow :disabled="sending || !reply.trim()">
            {{ sending ? 'Enviando…' : internal ? 'Adicionar nota' : 'Enviar resposta' }}
          </FwButton>
        </div>
      </form>
      <p v-else class="m-0 text-sm text-ink-muted">Chamado fechado: só leitura.</p>
    </section>

    <aside class="flex flex-col gap-6">
      <div class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-card">
        <FwSectionLabel>Atendimento</FwSectionLabel>
        <FwSelect
          :model-value="ticket.status"
          label="Status"
          :options="statusOptions"
          :disabled="isClosed || saving"
          @update:model-value="onStatus"
        />
        <FwSelect
          :model-value="ticket.priority"
          label="Prioridade"
          :options="priorityOptions"
          :disabled="isClosed || saving"
          @update:model-value="onPriority"
        />
        <FwSelect
          :model-value="ticket.assignee?.id ?? ''"
          label="Responsável"
          :options="assigneeOptions"
          :disabled="isClosed || saving"
          @update:model-value="onAssignee"
        />
        <FwButton
          v-if="!isClosed && !isMine && session.user"
          variant="secondary"
          :disabled="saving"
          @click="onAssignee(session.user.id)"
        >
          Assumir chamado
        </FwButton>
      </div>

      <div class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-card">
        <FwSectionLabel>Conversa com a Wen</FwSectionLabel>
        <div v-if="ticket.transcript.length" class="max-h-[60vh] overflow-y-auto pr-1">
          <TranscriptView :messages="ticket.transcript" />
        </div>
        <p v-else class="m-0 text-sm text-ink-muted">Nenhuma conversa anexada.</p>
        <FwButton :to="{ name: 'staff-dashboard' }" variant="secondary">Voltar à fila</FwButton>
      </div>
    </aside>
  </div>
</template>
