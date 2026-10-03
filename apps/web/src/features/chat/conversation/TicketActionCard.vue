<script setup lang="ts">
import { FwButton, FwIcon } from '@f-desk/ui'
import { computed, ref, useId } from 'vue'
import FormAlert from '../../../components/FormAlert.vue'
import { useChatStore, type ActionState } from '../../../stores/chat'

/**
 * Ação num chamado do cliente que a Wen preparou: adicionar uma informação, cancelar ou fechar como
 * resolvido. Nada acontece sem o "Confirmar", que vai pela rota de chamados (ela confere tudo de
 * novo). Pendente, fica fixa acima do campo de mensagem, como o cartão de chamado; confirmada ou
 * descartada, vira um registro na conversa.
 */
type ConfirmResult = Awaited<ReturnType<ReturnType<typeof useChatStore>['confirmAction']>>

const props = defineProps<{
  entryId: string
  action: ActionState
  /** Executa a ação (a página cuida do que vem depois, já que o box some ao confirmar). */
  run?: () => Promise<ConfirmResult>
}>()
const emit = defineEmits<{ dismissed: [] }>()

const chat = useChatStore()
const titleId = useId()
const submitting = ref(false)
const formError = ref('')

const TITLE = {
  reply: (code: string) => `Adicionar informação ao ${code}`,
  cancel: (code: string) => `Cancelar o chamado ${code}`,
  resolve: (code: string) => `Fechar o ${code} como resolvido`,
}
const DONE = {
  reply: (code: string) => `Informação adicionada ao ${code}`,
  cancel: (code: string) => `Chamado ${code} cancelado`,
  resolve: (code: string) => `Chamado ${code} fechado como resolvido`,
}
const HINT = {
  reply: 'A mensagem vai para a equipe no chamado, como se você tivesse escrito.',
  cancel: 'O chamado sai da fila da equipe e fica no seu histórico como cancelado.',
  resolve: 'O chamado é fechado como resolvido por você e não recebe novas respostas.',
}

const action = computed(() => props.action)

async function confirm() {
  if (!props.run) return
  formError.value = ''
  submitting.value = true
  const result = await props.run()
  submitting.value = false
  if (!result.ok) formError.value = result.error
}

function dismiss() {
  chat.dismissAction(props.entryId)
  emit('dismissed')
}
</script>

<template>
  <section
    :class="['chat-proposal', action.state === 'pending' && 'chat-proposal-docked']"
    :aria-labelledby="titleId"
    data-testid="ticket-action"
  >
    <template v-if="action.state === 'done'">
      <p :id="titleId" class="chat-proposal-done">
        <FwIcon name="check" size="sm" />{{ DONE[action.action](action.code) }}
      </p>
      <p class="m-0 text-sm font-semibold">{{ action.subject }}</p>
      <RouterLink :to="`/chamados/${action.code}`" class="chat-link self-start">
        Ver chamado
      </RouterLink>
    </template>

    <p v-else-if="action.state === 'dismissed'" :id="titleId" class="m-0 text-sm text-ink-muted">
      Ação no {{ action.code }} descartada. Se precisar, peça de novo aqui na conversa.
    </p>

    <template v-else>
      <p :id="titleId" class="chat-proposal-label">
        <FwIcon name="inbox" size="sm" />Ação preparada pela Wen
      </p>
      <div class="flex flex-col gap-1">
        <p class="m-0 font-semibold">{{ TITLE[action.action](action.code) }}</p>
        <p class="m-0 text-sm text-ink-muted">{{ action.subject }}</p>
      </div>
      <blockquote
        v-if="action.action === 'reply'"
        class="m-0 border-l-2 border-line-strong pl-3 text-sm whitespace-pre-line"
        data-testid="action-message"
      >
        {{ action.message }}
      </blockquote>
      <p class="m-0 text-sm">{{ HINT[action.action] }}</p>
      <FormAlert v-if="formError">{{ formError }}</FormAlert>
      <div class="flex flex-wrap gap-2">
        <FwButton size="sm" icon-left="check" :disabled="submitting" @click="confirm">
          {{ submitting ? 'Confirmando…' : 'Confirmar' }}
        </FwButton>
        <FwButton variant="ghost" size="sm" :disabled="submitting" @click="dismiss">
          Agora não
        </FwButton>
      </div>
    </template>
  </section>
</template>
