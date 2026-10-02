<script setup lang="ts">
import { FwButton, FwIcon, FwInput, FwLogo } from '@f-desk/ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../../../stores/chat'
import { useConversationsStore } from '../../../stores/conversations'
import { useSessionStore } from '../../../stores/session'
import ConversationList from './ConversationList.vue'
import SidebarAccount from './SidebarAccount.vue'

/**
 * Sidebar do atendimento: marca, nova conversa, busca e lista das conversas salvas (só o cliente
 * tem histórico) e a conta no rodapé. É a mesma no desktop e no drawer do celular.
 */
const session = useSessionStore()
const chat = useChatStore()
const conversations = useConversationsStore()
const route = useRoute()
const router = useRouter()

const isClient = computed(() => session.user?.role === 'client')
const activeId = computed(() =>
  typeof route.params.conversa === 'string' ? route.params.conversa : undefined,
)

const term = ref(conversations.query)
let timer: ReturnType<typeof setTimeout> | undefined
watch(term, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (value.trim() !== conversations.query) void conversations.search(value)
  }, 300)
})
onBeforeUnmount(() => clearTimeout(timer))

async function newConversation() {
  chat.reset()
  await router.push({ name: 'chat' })
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 p-4">
    <RouterLink to="/" class="fw-header-brand self-start"><FwLogo :height="30" /></RouterLink>

    <FwButton icon-left="plus" class="w-full" :disabled="chat.sending" @click="newConversation">
      Nova conversa
    </FwButton>

    <nav v-if="session.user" aria-label="Atalhos" class="flex flex-col">
      <RouterLink v-if="isClient" to="/chamados" class="sidebar-link">
        <FwIcon name="inbox" size="sm" />Meus chamados
      </RouterLink>
      <RouterLink v-else to="/tecnico" class="sidebar-link">
        <FwIcon name="bar-chart" size="sm" />Dashboard
      </RouterLink>
    </nav>

    <template v-if="isClient">
      <div role="search">
        <FwInput v-model="term" type="search" icon="search" placeholder="Buscar conversas" />
      </div>
      <h2 class="sr-only">Conversas</h2>
      <ConversationList :active-id="activeId" class="flex-1" />
    </template>

    <div
      v-else-if="!session.user"
      class="flex flex-col gap-2 rounded-md border border-line bg-surface-raised p-4"
    >
      <p class="m-0 font-semibold text-ink">Entre para guardar suas conversas</p>
      <p class="m-0 text-sm text-ink-muted">
        Com uma conta, cada conversa com o Wen fica salva aqui e pode virar um chamado. A conversa
        de agora vai junto.
      </p>
    </div>

    <p
      v-else
      class="m-0 rounded-md border border-line bg-surface-raised p-4 text-sm text-ink-muted"
    >
      O histórico de conversas é dos clientes. Os chamados ficam no Dashboard.
    </p>

    <div class="mt-auto border-t border-line pt-2">
      <SidebarAccount />
    </div>
  </div>
</template>
