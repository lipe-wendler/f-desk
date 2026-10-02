<script setup lang="ts">
import {
  fieldErrors,
  TICKET_MESSAGE_MAX,
  ticketProposalSchema,
  type TicketProposal,
} from '@f-desk/shared'
import { FwButton, FwIcon, FwInput, FwTextarea } from '@f-desk/ui'
import { computed, nextTick, reactive, ref, useId, useTemplateRef } from 'vue'
import FormAlert from '../../../components/FormAlert.vue'
import { useFieldErrors } from '../../../composables/useFieldErrors'
import { useChatStore, type ProposalState } from '../../../stores/chat'
import { useSessionStore } from '../../../stores/session'

/**
 * Chamado que o Wen preparou. Nada é aberto sem o cliente: ele confere, ajusta se quiser e
 * confirma. Visitante precisa entrar (a conversa segue depois do login); a equipe não abre chamado.
 * Pendente, fica fixo acima do campo de mensagem; aberto ou descartado, vira um registro na conversa.
 */
type ConfirmResult = Awaited<ReturnType<ReturnType<typeof useChatStore>['confirmProposal']>>

const props = defineProps<{
  entryId: string
  proposal: ProposalState
  /** Abre o chamado (a página cuida do que vem depois, já que o box some ao abrir). */
  open?: (input: TicketProposal) => Promise<ConfirmResult>
}>()
const emit = defineEmits<{ dismissed: [] }>()

const chat = useChatStore()
const session = useSessionStore()
const titleId = useId()
const root = useTemplateRef<HTMLElement>('root')

const proposal = computed(() => props.proposal)
const audience = computed(() =>
  !session.user ? 'visitor' : session.user.role === 'client' ? 'client' : 'staff',
)

const editing = ref(false)
const submitting = ref(false)
const formError = ref('')
const form = reactive({ subject: '', description: '' })
const errors = useFieldErrors(form)

/** Leva o foco para um elemento do cartão depois que a tela muda (o botão clicado some). */
async function focus(selector: string) {
  await nextTick()
  root.value?.querySelector<HTMLElement>(selector)?.focus()
}

function startEdit() {
  form.subject = proposal.value.subject
  form.description = proposal.value.description
  errors.value = {}
  formError.value = ''
  editing.value = true
  void focus('input')
}

function cancelEdit() {
  editing.value = false
  formError.value = ''
  void focus('[data-edit]')
}

async function confirm() {
  formError.value = ''
  const parsed = ticketProposalSchema.safeParse(
    editing.value
      ? form
      : { subject: proposal.value.subject, description: proposal.value.description },
  )
  if (!parsed.success) {
    // Só acontece no modo de ajuste: a proposta do Wen já chega dentro dos limites.
    errors.value = fieldErrors(parsed.error)
    return
  }
  if (!props.open) return
  submitting.value = true
  const result = await props.open(parsed.data)
  submitting.value = false
  if (!result.ok) {
    if (result.fields) errors.value = result.fields
    formError.value = result.error
    return
  }
  editing.value = false
}

function dismiss() {
  chat.dismissProposal(props.entryId)
  emit('dismissed')
}
</script>

<template>
  <section
    ref="root"
    :class="['chat-proposal', proposal.state === 'pending' && 'chat-proposal-docked']"
    :aria-labelledby="titleId"
    data-testid="ticket-proposal"
  >
    <template v-if="proposal.state === 'created'">
      <p :id="titleId" class="chat-proposal-done">
        <FwIcon name="check" size="sm" />Chamado {{ proposal.code }} aberto
      </p>
      <p class="m-0 text-sm font-semibold">{{ proposal.subject }}</p>
      <RouterLink :to="`/chamados/${proposal.code}`" class="chat-link self-start">
        Ver chamado
      </RouterLink>
    </template>

    <template v-else-if="proposal.state === 'dismissed'">
      <p :id="titleId" class="m-0 text-sm text-ink-muted">
        Proposta de chamado descartada. Se precisar, peça o chamado aqui na conversa.
      </p>
    </template>

    <template v-else>
      <p :id="titleId" class="chat-proposal-label">
        <FwIcon name="inbox" size="sm" />Chamado preparado pelo Wen
      </p>

      <form v-if="editing" class="flex flex-col gap-4" novalidate @submit.prevent="confirm">
        <FwInput v-model="form.subject" label="Assunto" :error="errors.subject" maxlength="140" />
        <FwTextarea
          v-model="form.description"
          label="Descrição"
          :error="errors.description"
          :max-length="TICKET_MESSAGE_MAX"
          rows="6"
        />
        <FormAlert v-if="formError">{{ formError }}</FormAlert>
        <div class="flex flex-wrap gap-2">
          <FwButton type="submit" size="sm" :disabled="submitting">
            {{ submitting ? 'Abrindo…' : 'Abrir chamado' }}
          </FwButton>
          <FwButton variant="ghost" size="sm" :disabled="submitting" @click="cancelEdit">
            Cancelar
          </FwButton>
        </div>
      </form>

      <template v-else>
        <dl class="m-0 flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <dt class="chat-proposal-term">Assunto</dt>
            <dd class="m-0 font-semibold">{{ proposal.subject }}</dd>
          </div>
          <div class="flex flex-col gap-1">
            <dt class="chat-proposal-term">Descrição</dt>
            <dd class="m-0 text-sm whitespace-pre-line text-ink-muted">
              {{ proposal.description }}
            </dd>
          </div>
        </dl>

        <template v-if="audience === 'client'">
          <FormAlert v-if="formError">{{ formError }}</FormAlert>
          <div class="flex flex-wrap gap-2">
            <FwButton size="sm" icon-left="check" :disabled="submitting" @click="confirm">
              {{ submitting ? 'Abrindo…' : 'Abrir chamado' }}
            </FwButton>
            <FwButton
              variant="secondary"
              size="sm"
              :disabled="submitting"
              data-edit
              @click="startEdit"
            >
              Ajustar
            </FwButton>
            <FwButton variant="ghost" size="sm" :disabled="submitting" @click="dismiss">
              Agora não
            </FwButton>
          </div>
        </template>

        <template v-else-if="audience === 'visitor'">
          <p class="m-0 text-sm">
            Entre para abrirmos o seu chamado. A conversa continua de onde parou.
          </p>
          <div class="flex flex-wrap gap-2">
            <FwButton :to="{ name: 'sign-in', query: { redirect: '/atendimento' } }" size="sm">
              Entrar
            </FwButton>
            <FwButton
              :to="{ name: 'sign-up', query: { redirect: '/atendimento' } }"
              variant="secondary"
              size="sm"
            >
              Criar conta
            </FwButton>
            <FwButton variant="ghost" size="sm" @click="dismiss">Agora não</FwButton>
          </div>
        </template>

        <div v-else class="flex flex-wrap items-center justify-between gap-2">
          <p class="m-0 text-sm text-ink-muted">Só clientes abrem chamados.</p>
          <FwButton variant="ghost" size="sm" @click="dismiss">Fechar</FwButton>
        </div>
      </template>
    </template>
  </section>
</template>
