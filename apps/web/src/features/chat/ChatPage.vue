<script setup lang="ts">
import { CHAT_INPUT_MAX, FAQ, FAQ_CATEGORIES, type FaqCategory } from '@f-desk/shared'
import { FwButton, FwIcon, FwSectionLabel, FwTabs, FwTag } from '@f-desk/ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../../composables/useToast'
import { useChatStore } from '../../stores/chat'
import { useConversationsStore } from '../../stores/conversations'
import { useSessionStore } from '../../stores/session'
import ChatComposer from './ChatComposer.vue'
import './chat.css'

/**
 * Chatbot público: qualquer visitante tira dúvidas sem conta. A página ocupa a altura da tela e só
 * a lista de mensagens rola. Do cliente, `/atendimento/:conversa` abre uma conversa salva.
 */
const chat = useChatStore()
const session = useSessionStore()
const conversations = useConversationsStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const draft = ref('')
const category = ref<FaqCategory>(FAQ_CATEGORIES[0].id)
const tabs = FAQ_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))
const suggestions = computed(() => FAQ.filter((entry) => entry.category === category.value))
const list = useTemplateRef<HTMLElement>('list')

const isClient = computed(() => session.user?.role === 'client')
const hasMessages = computed(() => chat.messages.length > 0)
const routeId = computed(() =>
  typeof route.params.conversa === 'string' ? route.params.conversa : undefined,
)

watch(
  () => session.user?.id ?? null,
  (userId) => chat.hydrate(userId),
  { immediate: true },
)

/** Rota e conversa aberta andam juntas: o id na URL abre a conversa; a conversa salva ganha URL. */
watch(
  [routeId, isClient],
  async ([id, client]) => {
    if (!client) return
    if (id && id !== chat.conversationId) {
      const ok = await chat.loadConversation(id)
      if (!ok) {
        toast.show('Conversa não encontrada.', 'danger')
        await router.replace({ name: 'chat' })
      }
      return
    }
    if (!id && chat.conversationId && !chat.sending)
      await router.replace({ name: 'chat', params: { conversa: chat.conversationId } })
  },
  { immediate: true },
)

// ---- Scroll: acompanha a resposta só se a pessoa já está no fim da conversa.
const NEAR_BOTTOM = 80
const atBottom = ref(true)

function onScroll() {
  const el = list.value
  if (!el) return
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM
}

function scrollToEnd() {
  list.value?.scrollTo({ top: list.value.scrollHeight })
  atBottom.value = true
}

watch(
  () => chat.messages.map((m) => m.content.length).join(),
  async () => {
    if (!atBottom.value) return
    await nextTick()
    scrollToEnd()
  },
)

// Conversa trocada (sidebar, nova conversa): começa do fim.
watch(
  () => chat.conversationId,
  async () => {
    await nextTick()
    scrollToEnd()
  },
)

async function send(text = draft.value) {
  const message = text.trim()
  if (!message || chat.sending) return
  draft.value = ''
  const before = chat.conversationId
  // Quem manda mensagem quer ver a resposta.
  atBottom.value = true
  const ok = await chat.send(message)
  if (!ok && !draft.value) draft.value = message
  if (!ok || !chat.conversationId) return
  // Conversa gravada: a lista da sidebar sobe esta conversa e a URL passa a apontar para ela.
  const first = chat.messages.find((m) => m.role === 'user')?.content ?? message
  conversations.touch({
    id: chat.conversationId,
    firstQuestion: first,
    lastMessage: chat.messages.at(-1)?.content ?? message,
    title: chat.meta?.title,
    kind: chat.meta?.kind,
  })
  if (chat.conversationId !== before || routeId.value !== chat.conversationId)
    await router.replace({ name: 'chat', params: { conversa: chat.conversationId } })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="hasMessages" class="relative flex min-h-0 flex-1 flex-col">
      <div
        ref="list"
        role="log"
        aria-label="Mensagens da conversa"
        aria-live="polite"
        class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-6 sm:px-8"
        data-testid="chat-messages"
        @scroll.passive="onScroll"
      >
        <h1 class="sr-only">Atendimento</h1>
        <div
          v-for="m in chat.messages"
          :key="m.id"
          :class="[
            'mx-auto flex w-full max-w-3xl flex-col gap-1',
            m.role === 'user' ? 'items-end' : 'items-start',
          ]"
        >
          <span class="font-mono text-[12px] tracking-[0.16em] text-ink-muted uppercase">
            {{ m.role === 'user' ? 'Você' : 'Wen' }}
            <template v-if="m.source === 'faq'"> · resposta pronta</template>
          </span>
          <p
            :class="[
              'm-0 max-w-[60ch] rounded-lg px-4 py-3 whitespace-pre-line',
              m.role === 'user' ? 'bg-surface-raised' : 'border border-line',
              m.failed && 'border-danger text-ink-muted',
            ]"
          >
            <template v-if="m.content">{{ m.content }}</template>
            <span v-else class="text-ink-muted">Digitando…</span>
          </p>
        </div>
      </div>
      <button
        v-if="!atBottom"
        type="button"
        class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-pill border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        @click="scrollToEnd"
      >
        <FwIcon name="chevron-down" size="sm" />Ir para o fim
      </button>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-8">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div class="flex flex-col gap-3">
          <FwSectionLabel bar>Atendimento</FwSectionLabel>
          <h1
            class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em] sm:text-[44px] sm:leading-[52px] sm:font-bold"
          >
            Como posso <span class="fw-hl">ajudar?</span>
          </h1>
          <p class="m-0 max-w-[56ch] text-ink-muted">
            Wen, assistente de suporte da F.Wendler, responde às dúvidas mais comuns na hora. Se o
            caso precisar de um técnico, você abre um chamado e acompanha tudo por aqui.
          </p>
        </div>
        <p v-if="chat.loading" class="m-0 text-sm text-ink-muted" role="status">
          Abrindo a conversa…
        </p>
        <div v-else class="flex flex-col gap-3">
          <FwTabs v-model="category" :items="tabs" label="Tipo de atendimento" variant="neutral" />
          <div class="flex flex-wrap gap-2">
            <FwTag v-for="s in suggestions" :key="s.id" clickable @click="send(s.question)">
              {{ s.question }}
            </FwTag>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-none bg-bg px-4 pt-2 pb-4 sm:px-8">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <ChatComposer
          v-model="draft"
          :max-length="CHAT_INPUT_MAX"
          :sending="chat.sending"
          :error="chat.notice || undefined"
          @submit="send()"
        >
          <template #actions>
            <!-- Até o Wen propor o chamado sozinho (tarefa 13). -->
            <FwButton
              v-if="hasMessages && !session.isStaff"
              :to="{ name: 'ticket-new' }"
              variant="ghost"
              size="sm"
              icon-left="plus"
            >
              Abrir chamado
            </FwButton>
          </template>
        </ChatComposer>
      </div>
    </div>
  </div>
</template>
