<script setup lang="ts">
import { CHAT_INPUT_MAX, FAQ, FAQ_CATEGORIES, type FaqCategory } from '@f-desk/shared'
import { FwButton, FwSectionLabel, FwTabs, FwTag, FwTextarea } from '@f-desk/ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useChatStore } from '../../stores/chat'
import { useSessionStore } from '../../stores/session'

/** Chatbot público: qualquer visitante tira dúvidas sem conta. Abrir chamado exige login. */
const chat = useChatStore()
const session = useSessionStore()

const draft = ref('')
const category = ref<FaqCategory>(FAQ_CATEGORIES[0].id)
const tabs = FAQ_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))
const suggestions = computed(() => FAQ.filter((entry) => entry.category === category.value))
const list = useTemplateRef<HTMLElement>('list')

const isClient = computed(() => session.user?.role === 'client')
const hasMessages = computed(() => chat.messages.length > 0)

watch(
  () => session.user?.id ?? null,
  (userId) => chat.hydrate(userId),
  { immediate: true },
)

// Acompanha a resposta enquanto ela chega.
watch(
  () => chat.messages.map((m) => m.content.length).join(),
  async () => {
    await nextTick()
    list.value?.scrollTo({ top: list.value.scrollHeight })
  },
)

async function send(text = draft.value) {
  const message = text.trim()
  if (!message || chat.sending) return
  draft.value = ''
  const ok = await chat.send(message)
  if (!ok && !draft.value) draft.value = message
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void send()
  }
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
    <section
      class="flex min-h-[480px] flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8"
    >
      <div class="flex flex-col gap-3">
        <FwSectionLabel bar>Atendimento</FwSectionLabel>
        <h1
          class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em] sm:text-[48px] sm:leading-[56px] sm:font-bold"
        >
          Como posso <span class="fw-hl">ajudar?</span>
        </h1>
        <p class="m-0 max-w-[56ch] text-ink-muted">
          Wen, assistente de suporte da F.Wendler, responde às dúvidas mais comuns na hora. Se o
          caso precisar de um técnico, você abre um chamado e acompanha tudo por aqui.
        </p>
      </div>

      <div
        v-if="hasMessages"
        ref="list"
        class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1"
        aria-live="polite"
        data-testid="chat-messages"
      >
        <div
          v-for="m in chat.messages"
          :key="m.id"
          :class="['flex flex-col gap-1', m.role === 'user' ? 'items-end' : 'items-start']"
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

      <div v-else class="flex flex-col gap-3">
        <FwTabs v-model="category" :items="tabs" label="Tipo de atendimento" variant="neutral" />
        <div class="flex flex-wrap gap-2">
          <FwTag v-for="s in suggestions" :key="s.id" clickable @click="send(s.question)">
            {{ s.question }}
          </FwTag>
        </div>
      </div>

      <div class="mt-auto flex flex-col gap-3">
        <FwTextarea
          v-model="draft"
          label="Sua mensagem"
          placeholder="Descreva o que está acontecendo…"
          :max-length="CHAT_INPUT_MAX"
          :error="chat.notice || undefined"
          hint="Enter envia; Shift+Enter quebra a linha. Não compartilhe senhas."
          @keydown="onKeydown"
        />
        <div class="flex flex-wrap items-center justify-end gap-2">
          <FwButton
            v-if="hasMessages"
            variant="ghost"
            :disabled="chat.sending"
            @click="chat.reset()"
          >
            Nova conversa
          </FwButton>
          <FwButton arrow :disabled="chat.sending || !draft.trim()" @click="send()">
            {{ chat.sending ? 'Respondendo…' : 'Enviar' }}
          </FwButton>
        </div>
      </div>
    </section>

    <aside class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-card">
      <FwSectionLabel>Precisa de um técnico?</FwSectionLabel>
      <p class="m-0 text-sm text-ink-muted">
        <template v-if="isClient">
          Abra um chamado e um técnico acompanha o seu caso. Esta conversa vai junto.
        </template>
        <template v-else>
          Para abrir um chamado e ver o histórico das suas conversas e chamados, entre na sua conta.
          Criar uma conta leva menos de um minuto, e esta conversa vai junto.
        </template>
      </p>
      <FwButton :to="{ name: 'ticket-new' }" icon-left="plus">Abrir chamado</FwButton>
      <FwButton v-if="!session.user" :to="{ name: 'sign-up' }" variant="secondary">
        Criar conta
      </FwButton>
    </aside>
  </div>
</template>
