<script setup lang="ts">
import { FwIconButton, FwLogo } from '@f-desk/ui'
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import ConversationSidebar from '../features/chat/sidebar/ConversationSidebar.vue'
import '../features/chat/sidebar/sidebar.css'

/**
 * Layout do atendimento em tela cheia: a página não rola, só as colunas. No desktop a sidebar fica
 * fixa; abaixo de 1024px ela abre num <dialog> (drawer) pelo botão de menu.
 */
const route = useRoute()
const drawer = useTemplateRef<HTMLDialogElement>('drawer')
const menuButton = useTemplateRef<InstanceType<typeof FwIconButton>>('menuButton')
const drawerOpen = ref(false)

async function openDrawer() {
  drawerOpen.value = true
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
  ;(menuButton.value?.$el as HTMLElement | undefined)?.focus()
}

watch(
  () => route.fullPath,
  () => closeDrawer(),
)
</script>

<template>
  <div class="grid h-dvh overflow-hidden bg-bg lg:grid-cols-[320px_minmax(0,1fr)]">
    <aside
      aria-label="Conversas"
      class="hidden min-h-0 border-r border-line bg-surface lg:flex lg:flex-col"
    >
      <ConversationSidebar />
    </aside>

    <div class="flex min-h-0 flex-col">
      <header
        class="flex flex-none items-center gap-3 border-b border-line bg-surface px-4 py-2 lg:hidden"
      >
        <FwIconButton
          ref="menuButton"
          icon="menu"
          label="Abrir conversas"
          aria-controls="drawer-de-conversas"
          :aria-expanded="drawerOpen ? 'true' : 'false'"
          size="sm"
          @click="openDrawer"
        />
        <RouterLink to="/" class="fw-header-brand"><FwLogo :height="26" /></RouterLink>
        <div class="ml-auto"><ThemeToggle /></div>
      </header>

      <main class="flex min-h-0 flex-1 flex-col">
        <RouterView />
      </main>
    </div>

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
