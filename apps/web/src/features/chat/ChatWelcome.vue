<script setup lang="ts">
import { GUIDED_FLOWS, type FaqCategory } from '@f-desk/shared'
import { FwIcon, FwSectionLabel, type IconName } from '@f-desk/ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../../stores/session'
import { ticketsApi } from '../tickets/tickets-api'

/**
 * Tela inicial do atendimento: as três formas de começar (com atalhos 1, 2 e 3). Dúvida e problema
 * abrem o atendimento guiado, sem LLM. Não há atalho direto para a equipe: todo caso passa pelo Wen,
 * que abre o chamado quando não resolve.
 */
const emit = defineEmits<{ start: [category: FaqCategory] }>()
const session = useSessionStore()
const router = useRouter()

const isClient = computed(() => session.user?.role === 'client')
const waiting = ref(0)

watch(
  isClient,
  async (client) => {
    waiting.value = 0
    if (!client) return
    // Chamados em que o técnico espera a resposta do cliente.
    const { data } = await ticketsApi.list('active', 1, 50)
    waiting.value = data?.tickets.filter((t) => t.status === 'waiting_client').length ?? 0
  },
  { immediate: true },
)

const track = computed(() => {
  if (session.isStaff)
    return {
      to: '/tecnico',
      title: 'Ver a fila de chamados',
      description: 'Abra o Dashboard da equipe.',
    }
  return {
    to: isClient.value ? '/chamados' : { name: 'sign-in', query: { redirect: '/chamados' } },
    title: 'Acompanhar uma solicitação',
    description: isClient.value
      ? 'Consulte o andamento dos seus chamados.'
      : 'Entre na sua conta para ver os seus chamados.',
  }
})

const flows: { category: FaqCategory; icon: IconName; key: string }[] = [
  { category: 'question', icon: 'help', key: '1' },
  { category: 'problem', icon: 'alert', key: '2' },
]

/** Atalhos 1, 2 e 3, só com o foco fora de campos de texto e sem teclas modificadoras. */
function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return
  const flow = flows.find((f) => f.key === event.key)
  if (flow) {
    event.preventDefault()
    emit('start', flow.category)
  } else if (event.key === '3') {
    event.preventDefault()
    void router.push(track.value.to)
  }
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-8">
    <div class="flex flex-col gap-3">
      <FwSectionLabel bar>Central de atendimento</FwSectionLabel>
      <h1
        class="m-0 font-display text-[32px] leading-10 font-bold tracking-[-0.02em] sm:text-[44px] sm:leading-[52px]"
      >
        Como podemos <span class="fw-hl">ajudar você?</span>
      </h1>
      <p class="m-0 max-w-[56ch] text-ink-muted">
        Tire dúvidas, resolva problemas ou acompanhe uma solicitação. Conte o que você precisa para
        começar.
      </p>
    </div>

    <section class="flex flex-col gap-3" aria-labelledby="comece-titulo">
      <h2
        id="comece-titulo"
        class="m-0 font-mono text-[11px] font-normal tracking-[0.16em] text-ink-muted uppercase"
      >
        Comece um atendimento
      </h2>
      <ul class="chat-start">
        <li v-for="flow in flows" :key="flow.category">
          <button
            type="button"
            class="chat-start-row"
            :aria-keyshortcuts="flow.key"
            @click="emit('start', flow.category)"
          >
            <span class="chat-start-icon"><FwIcon :name="flow.icon" /></span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="font-semibold text-ink">{{ GUIDED_FLOWS[flow.category].label }}</span>
              <span class="text-sm text-ink-muted">{{
                GUIDED_FLOWS[flow.category].description
              }}</span>
            </span>
            <kbd class="chat-kbd" aria-hidden="true">{{ flow.key }}</kbd>
            <FwIcon name="arrow-right" size="sm" class="text-ink-muted" />
          </button>
        </li>
        <li>
          <RouterLink :to="track.to" class="chat-start-row" aria-keyshortcuts="3">
            <span class="chat-start-icon"><FwIcon name="file" /></span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="flex flex-wrap items-center gap-2 font-semibold text-ink">
                {{ track.title }}
                <span v-if="waiting" class="chat-waiting"> {{ waiting }} aguardando você </span>
              </span>
              <span class="text-sm text-ink-muted">{{ track.description }}</span>
            </span>
            <kbd class="chat-kbd" aria-hidden="true">3</kbd>
            <FwIcon name="arrow-right" size="sm" class="text-ink-muted" />
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
