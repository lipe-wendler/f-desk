<script setup lang="ts">
import {
  CHAT_INPUT_MAX,
  FAQ,
  GUIDED_FEEDBACK,
  QUICK_SUGGESTIONS,
  TICKET_STATUS_LABEL,
  type FaqCategory,
  type FaqEntry,
  type TicketProposal,
} from '@f-desk/shared'
import { FwIcon, type IconName } from '@f-desk/ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../../composables/useToast'
import { useChatStore } from '../../stores/chat'
import { useConversationsStore } from '../../stores/conversations'
import { useSessionStore } from '../../stores/session'
import ChatComposer from './ChatComposer.vue'
import ChatHeader from './ChatHeader.vue'
import ChatWelcome from './ChatWelcome.vue'
import ChatBubble from './conversation/ChatBubble.vue'
import OptionList from './conversation/OptionList.vue'
import TicketActionCard from './conversation/TicketActionCard.vue'
import TicketChoiceList from './conversation/TicketChoiceList.vue'
import TicketCreatedCard from './conversation/TicketCreatedCard.vue'
import TicketProposalCard from './conversation/TicketProposalCard.vue'
import './chat.css'

/**
 * Atendimento: qualquer visitante conversa com o Wen sem conta. A página ocupa a altura da tela e
 * só a conversa rola. Dúvida e problema começam pelo atendimento guiado (respostas prontas, sem
 * LLM); o texto livre vai para o LLM. Do cliente, `/atendimento/:conversa` abre uma conversa salva.
 * Chamado só nasce aqui: quando o Wen não resolve, ele prepara um e o cliente confirma no cartão.
 */
const chat = useChatStore()
const session = useSessionStore()
const conversations = useConversationsStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const draft = ref('')
const list = useTemplateRef<HTMLElement>('list')
const composer = useTemplateRef<InstanceType<typeof ChatComposer>>('composer')
/** Texto lido pelos leitores de tela quando uma resposta termina (nunca pedaço por pedaço). */
const announcement = ref('')

const isClient = computed(() => session.user?.role === 'client')
const hasMessages = computed(() => chat.messages.length > 0)
const routeId = computed(() =>
  typeof route.params.conversa === 'string' ? route.params.conversa : undefined,
)
const lastId = computed(() => chat.messages.at(-1)?.id)

/** Nome da conversa no cabeçalho: o título do bot, a categoria escolhida ou a primeira fala. */
const title = computed(() => {
  if (!hasMessages.value) return 'Início'
  return (
    chat.meta?.title ?? chat.messages.find((m) => m.role === 'user')?.content ?? 'Nova conversa'
  )
})
const ticket = computed(() => chat.tickets.at(-1))
/** Chamado preparado à espera do cliente: fica fixo acima do campo de mensagem. */
const pendingProposal = computed(() =>
  chat.messages.findLast((m) => m.proposal?.state === 'pending'),
)
/** Ação num chamado preparada pela Wen, à espera da confirmação (também fica fixa embaixo). */
const pendingAction = computed(() => chat.messages.findLast((m) => m.action?.state === 'pending'))

const SUGGESTION_ICONS: Record<string, IconName> = {
  'sem-acesso-conta': 'key',
  'internet-lenta': 'zap',
  impressora: 'file',
  'email-nao-envia': 'mail',
}
const suggestions = QUICK_SUGGESTIONS.map((id) => FAQ.find((e) => e.id === id)!)

watch(
  () => session.user?.id ?? null,
  async (userId) => {
    chat.hydrate(userId)
    // Visitante que entrou como cliente: a conversa de antes do login passa a ser da conta.
    if (session.user?.role === 'client' && (await chat.importPartial())) await afterImported()
  },
  { immediate: true },
)

/** Conversa importada no login: entra na sidebar e a URL passa a apontar para ela. */
async function afterImported() {
  if (!chat.conversationId) return
  const said = chat.transcript
  conversations.touch({
    id: chat.conversationId,
    firstQuestion: said.find((m) => m.role === 'user')?.content ?? '',
    lastMessage: said.at(-1)?.content ?? '',
    title: chat.meta?.title,
    kind: chat.meta?.kind,
    added: said.length,
  })
  // A lista começou a carregar antes da importação terminar: a resposta viria sem a conversa.
  if (conversations.loading) void conversations.load()
  if (routeId.value !== chat.conversationId)
    await router.replace({ name: 'chat', params: { conversa: chat.conversationId } })
}

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
  () => chat.messages.map((m) => `${m.id}:${m.content.length}`).join(),
  async () => {
    if (!atBottom.value) return
    await nextTick()
    scrollToEnd()
  },
)

// Os boxes ocupam espaço embaixo: quem estava no fim continua vendo a última fala.
watch(
  () => `${pendingProposal.value?.id}:${pendingAction.value?.id}`,
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

function announceLast() {
  const last = chat.messages.at(-1)
  if (last?.role !== 'assistant' || !last.content) return
  announcement.value =
    last.proposal?.state === 'pending'
      ? `Wen: ${last.content} Chamado preparado: confira e confirme acima do campo de mensagem.`
      : last.ticketList?.length
        ? `Wen: ${last.content} ${last.ticketList.length} chamado(s) listado(s) para escolher.`
        : last.action?.state === 'pending'
          ? `Wen: ${last.content} Ação no chamado ${last.action.code} preparada: confirme acima do campo de mensagem.`
          : `Wen: ${last.content}`
}

/** Depois de uma troca gravada: a lista da sidebar sobe a conversa e a URL passa a apontar para ela. */
async function afterSaved(before: string | undefined, message: string) {
  if (!chat.conversationId) return
  conversations.touch({
    id: chat.conversationId,
    firstQuestion: chat.messages.find((m) => m.role === 'user' && !m.local)?.content ?? message,
    lastMessage: chat.messages.at(-1)?.content ?? message,
    title: chat.meta?.title,
    kind: chat.meta?.kind,
  })
  if (chat.conversationId !== before || routeId.value !== chat.conversationId)
    await router.replace({ name: 'chat', params: { conversa: chat.conversationId } })
}

async function send(text = draft.value) {
  const message = text.trim()
  if (!message || chat.sending) return
  draft.value = ''
  const before = chat.conversationId
  // Quem manda mensagem quer ver a resposta.
  atBottom.value = true
  const ok = await chat.send(message)
  if (!ok && !draft.value) draft.value = message
  if (!ok) return
  announceLast()
  await afterSaved(before, message)
}

/** Atalho da conversa vazia: pergunta do FAQ respondida pelo id, sem LLM. */
async function sendSuggestion(entry: FaqEntry) {
  if (chat.sending) return
  const before = chat.conversationId
  atBottom.value = true
  if (!(await chat.send(entry.question, { faqId: entry.id }))) return
  announceLast()
  await afterSaved(before, entry.question)
}

function startFlow(category: FaqCategory) {
  atBottom.value = true
  chat.startFlow(category)
  announceLast()
}

async function choose(entryId: string, optionId: string) {
  const before = chat.conversationId
  atBottom.value = true
  const result = await chat.chooseOption(entryId, optionId)
  if (result === 'failed') return
  announceLast()
  if (result === 'other') composer.value?.focus()
  else await afterSaved(before, chat.messages.findLast((m) => m.role === 'user')?.content ?? '')
}

async function feedback(entryId: string, resolved: boolean) {
  const promise = chat.giveFeedback(entryId, resolved, { save: isClient.value })
  announceLast()
  if (!resolved) composer.value?.focus()
  const saved = await promise
  // Não gravou: a resposta foi desfeita, então o leitor de tela ouve o erro no lugar dela.
  if (!saved) announcement.value = chat.notice
  if (!saved || !chat.conversationId || !isClient.value) return
  // Gravado: a conversa sobe na lista com a última fala.
  conversations.touch({
    id: chat.conversationId,
    firstQuestion: chat.messages.find((m) => m.role === 'user' && !m.local)?.content ?? '',
    lastMessage: chat.messages.at(-1)?.content ?? '',
  })
}

/** Chamado aberto pelo cartão: avisa o leitor de tela, sobe a conversa na lista e acerta a URL. */
async function proposalCreated(code: string) {
  announcement.value = `Chamado ${code} aberto.`
  if (!chat.conversationId) return
  conversations.touch({
    id: chat.conversationId,
    firstQuestion: chat.messages.find((m) => m.role === 'user' && !m.local)?.content ?? '',
    lastMessage: chat.messages.at(-1)?.content ?? '',
    title: chat.meta?.title,
    kind: chat.meta?.kind,
    ticketCode: code,
    added: 0,
  })
  if (routeId.value !== chat.conversationId)
    await router.replace({ name: 'chat', params: { conversa: chat.conversationId } })
}

function proposalDismissed() {
  announcement.value = 'Proposta de chamado descartada.'
}

/**
 * Confirmação do box. Fica aqui, e não no cartão, porque o box some assim que o chamado é aberto e
 * o que vem depois (foco, aviso, lista, URL) precisa rodar mesmo assim.
 */
async function confirmProposal(entryId: string, input: TicketProposal) {
  const result = await chat.confirmProposal(entryId, input)
  if (result.ok) await afterProposal(() => proposalCreated(result.code))
  return result
}

/** O box sai de baixo e o registro fica na conversa: o foco volta ao campo, e a conversa desce. */
async function afterProposal(handler: () => unknown) {
  composer.value?.focus()
  atBottom.value = true
  await handler()
}

/** Chamado escolhido na lista da Wen: vira a fala da pessoa e a conversa continua sobre ele. */
async function chooseTicket(entryId: string, code: string) {
  const before = chat.conversationId
  atBottom.value = true
  if (!(await chat.chooseTicket(entryId, code))) return
  // O clique foi no meio da conversa: a resposta (e o cartão que vier com ela) fica no fim.
  await nextTick()
  scrollToEnd()
  announceLast()
  await afterSaved(before, chat.messages.findLast((m) => m.role === 'user')?.content ?? '')
}

/** Confirmação do box da ação (fica aqui pelo mesmo motivo do chamado: o box some ao confirmar). */
async function confirmAction(entryId: string) {
  const result = await chat.confirmAction(entryId)
  if (result.ok) {
    const action = chat.messages.find((m) => m.id === entryId)?.action
    await afterProposal(() => {
      if (action) announcement.value = `Feito: ${action.code} atualizado.`
    })
  }
  return result
}

async function newConversation() {
  chat.reset()
  await router.push({ name: 'chat' })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <ChatHeader :current="title" @home="newConversation" />

    <div v-if="hasMessages" class="relative flex min-h-0 flex-1 flex-col">
      <div
        ref="list"
        class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8"
        data-testid="chat-messages"
        @scroll.passive="onScroll"
      >
        <div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div class="chat-conversation-head">
            <button type="button" class="chat-back" @click="newConversation">
              <FwIcon name="arrow-left" size="sm" />Voltar ao início
            </button>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h1 class="m-0 min-w-0 font-display text-2xl leading-8 font-bold tracking-[-0.01em]">
                {{ title }}
              </h1>
              <RouterLink
                v-if="ticket"
                :to="`/chamados/${ticket.code}`"
                class="chat-conversation-status"
              >
                <span class="size-2 rounded-pill bg-accent" aria-hidden="true" />
                Chamado {{ ticket.code }} · {{ TICKET_STATUS_LABEL[ticket.status] }}
              </RouterLink>
              <span
                v-else-if="chat.status === 'resolved'"
                class="chat-conversation-status chat-conversation-status-resolved"
              >
                <FwIcon name="check" size="sm" />Resolvido
              </span>
              <span v-else class="chat-conversation-status">
                <span class="size-2 rounded-pill bg-accent" aria-hidden="true" />Em andamento
              </span>
            </div>
          </div>

          <ol class="m-0 flex list-none flex-col gap-5 p-0" aria-label="Mensagens da conversa">
            <li v-for="m in chat.messages" :key="m.id">
              <ChatBubble :entry="m">
                <OptionList
                  v-if="m.options && !m.chosen && m.id === lastId"
                  :options="m.options"
                  :disabled="chat.sending"
                  label="Opções"
                  @choose="(id) => choose(m.id, id)"
                />
                <div
                  v-if="m.feedback === 'pending' && m.id === lastId && !chat.sending"
                  class="flex flex-wrap items-center gap-2 pt-1"
                >
                  <span class="text-sm text-ink-muted">{{ GUIDED_FEEDBACK.question }}</span>
                  <button type="button" class="chat-chip" @click="feedback(m.id, true)">
                    <FwIcon name="check" size="sm" />{{ GUIDED_FEEDBACK.resolved.label }}
                  </button>
                  <button type="button" class="chat-chip" @click="feedback(m.id, false)">
                    <FwIcon name="close" size="sm" />{{ GUIDED_FEEDBACK.unresolved.label }}
                  </button>
                </div>
                <TicketChoiceList
                  v-if="m.ticketList?.length"
                  :tickets="m.ticketList"
                  :chosen="m.ticketChosen"
                  :disabled="chat.sending || m.id !== lastId"
                  @choose="(code) => chooseTicket(m.id, code)"
                />
                <TicketCreatedCard
                  v-if="m.ticket"
                  :code="m.ticket.code"
                  :subject="m.ticket.subject"
                />
                <TicketProposalCard
                  v-if="m.proposal?.state === 'dismissed'"
                  :entry-id="m.id"
                  :proposal="m.proposal"
                />
                <TicketActionCard
                  v-if="m.action?.state === 'done' || m.action?.state === 'dismissed'"
                  :entry-id="m.id"
                  :action="m.action"
                />
              </ChatBubble>
            </li>
          </ol>
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
      <p v-if="chat.loading" class="m-auto text-sm text-ink-muted" role="status">
        Abrindo a conversa…
      </p>
      <ChatWelcome v-else @start="startFlow" />
    </div>

    <p class="sr-only" aria-live="polite">{{ announcement }}</p>

    <div class="flex-none bg-bg px-4 pt-2 pb-4 sm:px-8">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <ul v-if="!hasMessages && !chat.loading" class="chat-suggestions" aria-label="Sugestões">
          <li v-for="s in suggestions" :key="s.id">
            <button
              type="button"
              class="chat-chip"
              :disabled="chat.sending"
              @click="sendSuggestion(s)"
            >
              <FwIcon :name="SUGGESTION_ICONS[s.id] ?? 'message'" size="sm" />{{ s.question }}
            </button>
          </li>
        </ul>
        <TicketProposalCard
          v-if="pendingProposal?.proposal && !chat.sending"
          :key="pendingProposal.id"
          :entry-id="pendingProposal.id"
          :proposal="pendingProposal.proposal"
          :open="(input: TicketProposal) => confirmProposal(pendingProposal!.id, input)"
          @dismissed="afterProposal(proposalDismissed)"
        />
        <TicketActionCard
          v-if="pendingAction?.action && !chat.sending"
          :key="`action-${pendingAction.id}`"
          :entry-id="pendingAction.id"
          :action="pendingAction.action"
          :run="() => confirmAction(pendingAction!.id)"
          @dismissed="afterProposal(() => (announcement = 'Ação descartada.'))"
        />
        <ChatComposer
          ref="composer"
          v-model="draft"
          :max-length="CHAT_INPUT_MAX"
          :sending="chat.sending"
          :error="chat.notice || undefined"
          @submit="send()"
        />
      </div>
    </div>
  </div>
</template>
