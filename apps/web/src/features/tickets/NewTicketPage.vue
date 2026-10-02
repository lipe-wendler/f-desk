<script setup lang="ts">
import {
  createTicketSchema,
  fieldErrors,
  TICKET_MESSAGE_MAX,
  type TranscriptMessage,
} from '@f-desk/shared'
import { FwButton, FwCheckbox, FwInput, FwSectionLabel, FwTextarea } from '@f-desk/ui'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormAlert from '../../components/FormAlert.vue'
import { useFieldErrors } from '../../composables/useFieldErrors'
import { useToast } from '../../composables/useToast'
import { useChatStore } from '../../stores/chat'
import { useSessionStore } from '../../stores/session'
import { conversationsApi, ticketsApi } from './tickets-api'
import TranscriptView from './TranscriptView.vue'

/**
 * Abertura de chamado. A conversa com a Wen vai junto: a do chat atual (que pode ter começado
 * antes do login) ou uma do histórico (`?conversa=<id>`).
 */
const route = useRoute()
const router = useRouter()
const chat = useChatStore()
const session = useSessionStore()
const { show } = useToast()

const form = reactive({ subject: '', description: '' })
const errors = useFieldErrors(form)
const formError = ref('')
const submitting = ref(false)
const attach = ref(true)

chat.hydrate(session.user?.id ?? null)

// Conversa do histórico, quando o cliente vem de "Minhas conversas".
const savedId = typeof route.query.conversa === 'string' ? route.query.conversa : undefined
const saved = ref<TranscriptMessage[] | null>(null)
if (savedId) {
  void conversationsApi.get(savedId).then((r) => {
    saved.value = r.error === null ? r.data.messages : []
  })
}

const preview = computed<TranscriptMessage[]>(() =>
  savedId
    ? (saved.value ?? [])
    : chat.transcript.map((m) => ({ role: m.role, content: m.content, source: null })),
)
const hasConversation = computed(() => preview.value.length > 0)

async function submit() {
  formError.value = ''
  const useChat = attach.value && hasConversation.value && !savedId
  const attachment = savedId
    ? { conversationId: attach.value ? savedId : undefined, transcript: [] }
    : useChat
      ? chat.ticketAttachment
      : { conversationId: undefined, transcript: [] }
  const input = { ...form, ...attachment }
  const parsed = createTicketSchema.safeParse(input)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }
  submitting.value = true
  const result = await ticketsApi.create(parsed.data)
  submitting.value = false
  if (result.error !== null) {
    if (result.fields) errors.value = result.fields
    formError.value = result.error
    return
  }
  // A conversa agora está no chamado: o chat recomeça do zero.
  if (useChat) chat.reset()
  show(`Chamado ${result.data.code} aberto.`)
  await router.push({ name: 'ticket', params: { id: result.data.code } })
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <form
      class="flex flex-col gap-5 rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8"
      novalidate
      @submit.prevent="submit"
    >
      <div class="flex flex-col gap-3">
        <FwSectionLabel bar>Abrir chamado</FwSectionLabel>
        <h1 class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em]">
          Descreva o <span class="fw-hl">problema</span>
        </h1>
        <p class="m-0 max-w-[56ch] text-ink-muted">
          Conte o que aconteceu, quando começou e o que você já tentou. Nunca informe senhas.
        </p>
      </div>

      <FormAlert v-if="formError">{{ formError }}</FormAlert>
      <FwInput
        v-model="form.subject"
        label="Assunto"
        placeholder="Ex.: Impressora do escritório não imprime"
        :error="errors.subject"
        maxlength="140"
      />
      <FwTextarea
        v-model="form.description"
        label="Descrição"
        placeholder="O que aconteceu, desde quando, mensagens de erro…"
        :max-length="TICKET_MESSAGE_MAX"
        :error="errors.description"
        rows="8"
      />
      <FwCheckbox
        v-if="hasConversation"
        v-model="attach"
        :label="`Anexar a conversa com a Wen (${preview.length} mensagens)`"
      />
      <div class="flex flex-wrap justify-end gap-2">
        <FwButton variant="ghost" :to="{ name: 'tickets' }">Cancelar</FwButton>
        <FwButton type="submit" arrow :disabled="submitting">
          {{ submitting ? 'Abrindo…' : 'Abrir chamado' }}
        </FwButton>
      </div>
    </form>

    <aside class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-card">
      <FwSectionLabel>Conversa com a Wen</FwSectionLabel>
      <template v-if="hasConversation">
        <p class="m-0 text-sm text-ink-muted">
          {{
            attach
              ? 'Vai junto com o chamado, para o técnico não precisar perguntar de novo.'
              : 'Não será anexada.'
          }}
        </p>
        <div :class="['max-h-[60vh] overflow-y-auto pr-1', !attach && 'opacity-50']">
          <TranscriptView :messages="preview" />
        </div>
      </template>
      <p v-else class="m-0 text-sm text-ink-muted">
        Nenhuma conversa para anexar. Se quiser, tire a dúvida com a Wen antes: muitas vezes a
        resposta sai na hora.
      </p>
    </aside>
  </div>
</template>
