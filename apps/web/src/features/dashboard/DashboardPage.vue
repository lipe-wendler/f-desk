<script setup lang="ts">
import {
  STAFF_QUEUE_LABEL,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  type StaffMetrics,
  type StaffQueue,
  type StaffTicketSummary,
  type TicketPriority,
} from '@f-desk/shared'
import { FwButton, FwInput, FwMetricCard, FwSectionLabel, FwSelect, FwTabs } from '@f-desk/ui'
import { computed, ref, watch } from 'vue'
import FormAlert from '../../components/FormAlert.vue'
import { formatDateTime } from '../../lib/format'
import TicketStatusTag from '../tickets/TicketStatusTag.vue'
import { staffApi } from './staff-api'

/** Fila de chamados da equipe: métricas, filtros e a lista por prioridade. */
const PAGE_SIZE = 20
const queue = ref<StaffQueue>('active')
const priority = ref('')
const search = ref('')
const page = ref(1)
const tickets = ref<StaffTicketSummary[]>([])
const total = ref(0)
const metrics = ref<StaffMetrics | null>(null)
const loading = ref(true)
const error = ref('')

const queues = computed(() =>
  (['active', 'mine', 'unassigned', 'done', 'all'] as const).map((value) => {
    const n =
      value === 'mine'
        ? metrics.value?.mine
        : value === 'unassigned'
          ? metrics.value?.unassigned
          : undefined
    return { value, label: n ? `${STAFF_QUEUE_LABEL[value]} (${n})` : STAFF_QUEUE_LABEL[value] }
  }),
)
const priorities = [
  { value: '', label: 'Todas' },
  ...[...TICKET_PRIORITIES].reverse().map((p) => ({ value: p, label: TICKET_PRIORITY_LABEL[p] })),
]
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

async function load() {
  loading.value = true
  const [list, numbers] = await Promise.all([
    staffApi.list({
      queue: queue.value,
      priority: (priority.value || undefined) as TicketPriority | undefined,
      search: search.value,
      page: page.value,
      pageSize: PAGE_SIZE,
    }),
    staffApi.metrics(),
  ])
  loading.value = false
  if (numbers.error === null) metrics.value = numbers.data
  if (list.error !== null) {
    error.value = list.error
    return
  }
  error.value = ''
  tickets.value = list.data.tickets
  total.value = list.data.total
}

function restart() {
  if (page.value === 1) void load()
  else page.value = 1
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(restart, 300)
})
watch([queue, priority], restart)
watch(page, load)
void load()
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <FwMetricCard :value="metrics?.open ?? '—'" label="Abertos" icon="inbox" kicker="Fila" />
      <FwMetricCard
        :value="metrics?.inProgress ?? '—'"
        label="Em atendimento"
        icon="clock"
        kicker="Agora"
      />
      <FwMetricCard
        :value="metrics?.waitingClient ?? '—'"
        label="Aguardando cliente"
        icon="message"
        kicker="Cliente"
      />
      <FwMetricCard
        :value="metrics?.resolvedThisWeek ?? '—'"
        label="Resolvidos em 7 dias"
        icon="check"
        kicker="Semana"
      />
    </div>

    <section
      class="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8"
    >
      <div class="flex flex-col gap-3">
        <FwSectionLabel bar>Dashboard</FwSectionLabel>
        <h1 class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em]">
          Fila de <span class="fw-hl">chamados</span>
        </h1>
      </div>

      <FwTabs v-model="queue" :items="queues" label="Fila" variant="neutral" />
      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <FwInput
          v-model="search"
          label="Buscar"
          icon="search"
          placeholder="Código, assunto, cliente ou e-mail"
        />
        <FwSelect v-model="priority" label="Prioridade" :options="priorities" />
      </div>

      <FormAlert v-if="error">{{ error }}</FormAlert>
      <p v-else-if="loading && !tickets.length" class="m-0 text-ink-muted">Carregando…</p>
      <p v-else-if="!tickets.length" class="m-0 text-ink-muted">Nenhum chamado nesta fila.</p>
      <ul v-else class="m-0 flex list-none flex-col divide-y divide-line p-0" data-testid="queue">
        <li v-for="t in tickets" :key="t.code">
          <RouterLink
            :to="{ name: 'staff-ticket', params: { id: t.code } }"
            class="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 text-ink no-underline hover:text-accent-text focus-visible:text-accent-text"
          >
            <span class="font-mono text-[13px] text-ink-muted">{{ t.code }}</span>
            <span class="flex min-w-0 flex-1 basis-60 flex-col">
              <span class="font-semibold">{{ t.subject }}</span>
              <span class="text-sm text-ink-muted">{{ t.client.name }} · {{ t.client.email }}</span>
            </span>
            <TicketStatusTag :status="t.status" />
            <span
              :class="[
                'text-sm',
                t.priority === 'urgent' || t.priority === 'high'
                  ? 'font-semibold text-accent-text'
                  : 'text-ink-muted',
              ]"
            >
              {{ TICKET_PRIORITY_LABEL[t.priority] }}
            </span>
            <span class="text-sm text-ink-muted">{{ t.assignee?.name ?? 'Sem responsável' }}</span>
            <span class="text-sm text-ink-muted">{{ formatDateTime(t.createdAt) }}</span>
          </RouterLink>
        </li>
      </ul>

      <div v-if="pages > 1" class="flex items-center justify-between gap-2">
        <span class="text-sm text-ink-muted"
          >Página {{ page }} de {{ pages }} · {{ total }} chamados</span
        >
        <div class="flex gap-2">
          <FwButton variant="secondary" size="sm" :disabled="page <= 1" @click="page--"
            >Anterior</FwButton
          >
          <FwButton variant="secondary" size="sm" :disabled="page >= pages" @click="page++"
            >Próxima</FwButton
          >
        </div>
      </div>
    </section>
  </div>
</template>
