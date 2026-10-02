<script setup lang="ts">
import type { ConversationSummary, TranscriptMessage } from '@f-desk/shared'
import { FwButton, FwSectionLabel } from '@f-desk/ui'
import { computed, reactive, ref, watch } from 'vue'
import FormAlert from '../../components/FormAlert.vue'
import { formatDateTime } from '../../lib/format'
import { conversationsApi } from './tickets-api'
import TranscriptView from './TranscriptView.vue'

/** Conversas do cliente com a Wen. Qualquer uma pode virar um chamado. */
const PAGE_SIZE = 20
const page = ref(1)
const conversations = ref<ConversationSummary[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const open = ref<string | null>(null)
const details = reactive<Record<string, TranscriptMessage[] | 'erro'>>({})

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

async function load() {
  loading.value = true
  const result = await conversationsApi.list(page.value, PAGE_SIZE)
  loading.value = false
  if (result.error !== null) {
    error.value = result.error
    return
  }
  error.value = ''
  conversations.value = result.data.conversations
  total.value = result.data.total
}

async function toggle(id: string) {
  open.value = open.value === id ? null : id
  if (open.value && !details[id]) {
    const result = await conversationsApi.get(id)
    details[id] = result.error === null ? result.data.messages : 'erro'
  }
}

watch(page, load)
void load()
</script>

<template>
  <section
    class="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8"
  >
    <div class="flex flex-col gap-3">
      <FwSectionLabel bar>Conversas</FwSectionLabel>
      <h1 class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em]">
        Suas conversas com a <span class="fw-hl">Wen</span>
      </h1>
      <p class="m-0 max-w-[60ch] text-ink-muted">
        As conversas feitas com a sua conta ficam aqui. Se o problema não foi resolvido, abra um
        chamado a partir de qualquer uma delas.
      </p>
    </div>

    <FormAlert v-if="error">{{ error }}</FormAlert>
    <p v-else-if="loading && !conversations.length" class="m-0 text-ink-muted">Carregando…</p>
    <div v-else-if="!conversations.length" class="flex flex-col items-start gap-3">
      <p class="m-0 text-ink-muted">Nenhuma conversa ainda.</p>
      <FwButton :to="{ name: 'chat' }" variant="secondary" size="sm">Falar com a Wen</FwButton>
    </div>
    <ul
      v-else
      class="m-0 flex list-none flex-col divide-y divide-line p-0"
      data-testid="conversation-list"
    >
      <li v-for="c in conversations" :key="c.id" class="flex flex-col gap-3 py-4">
        <button
          type="button"
          class="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 border-0 bg-transparent p-0 text-left text-ink hover:text-accent-text focus-visible:text-accent-text"
          :aria-expanded="open === c.id ? 'true' : 'false'"
          @click="toggle(c.id)"
        >
          <span class="min-w-0 flex-1 basis-60 font-semibold">{{
            c.firstQuestion ?? 'Conversa'
          }}</span>
          <span class="text-sm text-ink-muted">{{ c.messageCount }} mensagens</span>
          <span class="text-sm text-ink-muted">{{ formatDateTime(c.updatedAt) }}</span>
        </button>
        <div v-if="open === c.id" class="flex flex-col gap-4">
          <p v-if="details[c.id] === 'erro'" class="m-0 text-sm text-ink-muted">
            Não consegui carregar esta conversa.
          </p>
          <p v-else-if="!details[c.id]" class="m-0 text-sm text-ink-muted">Carregando…</p>
          <TranscriptView v-else :messages="details[c.id] as TranscriptMessage[]" />
          <div class="flex flex-wrap gap-2">
            <FwButton
              v-if="c.ticketCode"
              :to="{ name: 'ticket', params: { id: c.ticketCode } }"
              variant="secondary"
              size="sm"
            >
              Ver chamado {{ c.ticketCode }}
            </FwButton>
            <FwButton
              :to="{ name: 'ticket-new', query: { conversa: c.id } }"
              size="sm"
              icon-left="plus"
            >
              Abrir chamado com esta conversa
            </FwButton>
          </div>
        </div>
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
