<script setup lang="ts">
import { FwIconButton } from '@f-desk/ui'
import { nextTick, provide, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import ConversationSidebar from '../features/chat/sidebar/ConversationSidebar.vue'
import '../features/chat/sidebar/sidebar.css'
import { CONVERSATIONS_DRAWER } from '../features/chat/shell'

/**
 * Layout do atendimento em tela cheia: a página não rola, só as colunas. No desktop a sidebar fica
 * fixa; abaixo de 1024px ela abre num <dialog> (drawer) pelo botão de menu do cabeçalho da página.
 */
const route = useRoute()
const drawer = useTemplateRef<HTMLDialogElement>('drawer')
const drawerOpen = ref(false)
let trigger: HTMLElement | null = null

async function openDrawer(from: HTMLElement | null) {
  trigger = from
  drawerOpen.value = true
  from?.setAttribute('aria-expanded', 'true')
  await nextTick()
  drawer.value?.showModal?.()
}

function closeDrawer() {
  if (!drawerOpen.value) return
  if (drawer.value?.open) drawer.value.close()
  else onDrawerClose()
}

/** O <dialog> fecha sozinho com Esc; aqui o estado acompanha e o foco volta ao botão. */
function onDrawerClose() {
  drawerOpen.value = false
  trigger?.setAttribute('aria-expanded', 'false')
  trigger?.focus()
}

provide(CONVERSATIONS_DRAWER, { open: openDrawer })

watch(
  () => route.fullPath,
  () => closeDrawer(),
)
</script>

<template>
  <div
    class="grid h-dvh grid-cols-[minmax(0,1fr)] overflow-hidden bg-bg lg:grid-cols-[320px_minmax(0,1fr)]"
  >
    <aside
      aria-label="Conversas"
      class="hidden min-h-0 border-r border-line bg-surface lg:flex lg:flex-col"
    >
      <ConversationSidebar />
    </aside>

    <main class="flex min-h-0 min-w-0 flex-col">
      <RouterView />
    </main>

    <dialog
      v-if="drawerOpen"
      id="drawer-de-conversas"
      ref="drawer"
      class="shell-drawer"
      aria-label="Conversas"
      @close="onDrawerClose"
      @click.self="closeDrawer"
    >
      <div class="flex h-full flex-col">
        <div class="flex justify-end px-4 pt-3">
          <FwIconButton icon="close" label="Fechar conversas" size="sm" @click="closeDrawer" />
        </div>
        <div class="min-h-0 flex-1">
          <ConversationSidebar />
        </div>
      </div>
    </dialog>
  </div>
</template>
