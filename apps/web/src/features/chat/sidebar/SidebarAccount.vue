<script setup lang="ts">
import { ROLE_LABEL } from '@f-desk/shared'
import { FwButton, FwIcon, useTheme } from '@f-desk/ui'
import { computed, useId, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useDropdownMenu } from '../../../composables/useDropdownMenu'
import { initialsOf } from '../../../lib/initials'
import { useConversationsStore } from '../../../stores/conversations'
import { useSessionStore } from '../../../stores/session'

/** Rodapé da sidebar: quem está logado e o menu da conta (atalhos, tema e sair). */
const session = useSessionStore()
const conversations = useConversationsStore()
const router = useRouter()
const { theme, toggleTheme } = useTheme()
// A sidebar existe duas vezes (desktop e drawer): o id do menu precisa ser único.
const menuId = useId()

const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const { open, toggle, close, moveFocus } = useDropdownMenu(root, trigger)

const user = computed(() => session.user)
const initials = computed(() => initialsOf(user.value?.name ?? ''))

const links = computed(() => {
  switch (user.value?.role) {
    case 'client':
      return [{ label: 'Meus chamados', to: '/chamados', icon: 'inbox' as const }]
    case 'technician':
      return [{ label: 'Dashboard', to: '/tecnico', icon: 'bar-chart' as const }]
    case 'admin':
      return [
        { label: 'Dashboard', to: '/tecnico', icon: 'bar-chart' as const },
        { label: 'Usuários', to: '/admin/usuarios', icon: 'users' as const },
      ]
    default:
      return []
  }
})

function switchTheme() {
  toggleTheme()
  close(true)
}

async function signOut() {
  close()
  await session.signOut()
  conversations.reset()
  await router.push({ name: 'sign-in' })
}
</script>

<template>
  <div v-if="user" ref="root" class="relative" @keydown.esc="close(true)">
    <div class="flex items-center gap-3 rounded-md p-2">
      <img
        v-if="user.image"
        :src="user.image"
        alt=""
        width="36"
        height="36"
        class="size-9 flex-none rounded-pill object-cover"
      />
      <span
        v-else
        class="grid size-9 flex-none place-items-center rounded-pill bg-accent font-mono text-xs font-bold text-on-accent"
        aria-hidden="true"
        >{{ initials }}</span
      >
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-semibold text-ink">{{ user.name }}</span>
        <span class="truncate text-xs text-ink-muted">{{ ROLE_LABEL[user.role] }}</span>
      </div>
      <button
        ref="trigger"
        type="button"
        class="sidebar-icon-btn"
        aria-haspopup="menu"
        aria-label="Configurações da conta"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="menuId"
        @click="toggle()"
        @keydown.up.prevent="toggle(true)"
      >
        <FwIcon name="gear" />
      </button>
    </div>

    <div
      v-show="open"
      :id="menuId"
      role="menu"
      aria-label="Conta"
      class="absolute right-0 bottom-[calc(100%+8px)] left-0 z-20 flex flex-col gap-1 rounded-md border border-line bg-surface p-2 shadow-pop"
      @keydown.down.prevent="moveFocus(1)"
      @keydown.up.prevent="moveFocus(-1)"
    >
      <div class="flex flex-col px-2 pt-1 pb-2" role="none">
        <span class="truncate text-xs text-ink-muted">{{ user.email }}</span>
      </div>
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        role="menuitem"
        class="sidebar-menu-item"
      >
        <FwIcon :name="link.icon" size="sm" class="text-ink-muted" />{{ link.label }}
      </RouterLink>
      <button type="button" role="menuitem" class="sidebar-menu-item" @click="switchTheme">
        <FwIcon :name="theme === 'dark' ? 'sun' : 'moon'" size="sm" class="text-ink-muted" />
        {{ theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro' }}
      </button>
      <div class="h-px bg-line" role="separator" />
      <button type="button" role="menuitem" class="sidebar-menu-item" @click="signOut">
        <FwIcon name="log-out" size="sm" class="text-ink-muted" />Sair
      </button>
    </div>
  </div>

  <div v-else class="flex flex-col gap-2 p-2">
    <FwButton :to="{ name: 'sign-in', query: { redirect: '/atendimento' } }" class="w-full">
      Entrar
    </FwButton>
    <FwButton
      :to="{ name: 'sign-up', query: { redirect: '/atendimento' } }"
      variant="secondary"
      class="w-full"
    >
      Criar conta
    </FwButton>
  </div>
</template>
