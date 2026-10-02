<script setup lang="ts">
import { TICKET_PRIORITY_LABEL, type TicketSummary } from '@f-desk/shared'
import { FwButton, FwSectionLabel, FwTabs } from '@f-desk/ui'
import { computed, ref, watch } from 'vue'
import FormAlert from '../../components/FormAlert.vue'
import { formatDateTime } from '../../lib/format'
import { ticketsApi, type TicketScope } from './tickets-api'
import TicketStatusTag from './TicketStatusTag.vue'

/** Chamados do cliente: em aberto, encerrados ou todos, do mais recente para o mais antigo. */
const PAGE_SIZE = 20
const scope = ref<TicketScope>('active')
const page = ref(1)
const tickets = ref<TicketSummary[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')

const scopes = [
  { value: 'active', label: 'Em aberto' },
  { value: 'done', label: 'Encerrados' },
  { value: 'all', label: 'Todos' },
]
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const emptyText = computed(
  () =>
    ({
      active: 'Nenhum chamado em aberto.',
      done: 'Nenhum chamado encerrado ainda.',
      all: 'Você ainda não abriu nenhum chamado.',
    })[scope.value],
)

async function load() {
  loading.value = true
  const result = await ticketsApi.list(scope.value, page.value, PAGE_SIZE)
  loading.value = false
  if (result.error !== null) {
    error.value = result.error
    return
  }
  error.value = ''
  tickets.value = result.data.tickets
  total.value = result.data.total
}

watch(scope, () => {
  if (page.value === 1) void load()
  else page.value = 1
})
watch(page, load)
void load()
</script>

<template>
  <section
    class="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8"
  >
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-3">
        <FwSectionLabel bar>Meus chamados</FwSectionLabel>
        <h1 class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em]">
          Seus <span class="fw-hl">chamados</span>
        </h1>
      </div>
      <FwButton :to="{ name: 'ticket-new' }" icon-left="plus">Abrir chamado</FwButton>
    </div>

    <FwTabs v-model="scope" :items="scopes" label="Filtrar chamados" variant="neutral" />

    <FormAlert v-if="error">{{ error }}</FormAlert>
    <p v-else-if="loading && !tickets.length" class="m-0 text-ink-muted">Carregando…</p>
    <div v-else-if="!tickets.length" class="flex flex-col items-start gap-3">
      <p class="m-0 text-ink-muted">{{ emptyText }}</p>
      <FwButton v-if="scope !== 'done'" :to="{ name: 'chat' }" variant="secondary" size="sm">
        Falar com a Wen
      </FwButton>
    </div>
    <ul
      v-else
      class="m-0 flex list-none flex-col divide-y divide-line p-0"
      data-testid="ticket-list"
    >
      <li v-for="t in tickets" :key="t.code">
        <RouterLink
          :to="{ name: 'ticket', params: { id: t.code } }"
          class="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 text-ink no-underline hover:text-accent-text focus-visible:text-accent-text"
        >
          <span class="font-mono text-[13px] text-ink-muted">{{ t.code }}</span>
          <span class="min-w-0 flex-1 basis-60 font-semibold">{{ t.subject }}</span>
          <TicketStatusTag :status="t.status" />
          <span class="text-sm text-ink-muted"
            >Prioridade {{ TICKET_PRIORITY_LABEL[t.priority].toLowerCase() }}</span
          >
          <span class="text-sm text-ink-muted"
            >Atualizado em {{ formatDateTime(t.updatedAt) }}</span
          >
        </RouterLink>
      </li>
    </ul>

    <div v-if="pages > 1" class="flex items-center justify-between gap-2">
      <span class="text-sm text-ink-muted">Página {{ page }} de {{ pages }}</span>
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
</template>
