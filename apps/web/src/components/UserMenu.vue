<script setup lang="ts">
import { ROLE_LABEL } from '@f-desk/shared'
import { FwIcon, FwTag } from '@f-desk/ui'
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

/** Menu do usuário logado: identificação, atalhos do perfil e sair. */
const session = useSessionStore()
const router = useRouter()
const route = useRoute()

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const panel = useTemplateRef<HTMLElement>('panel')

const user = computed(() => session.user)
const initials = computed(() =>
  (user.value?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join(''),
)

const links = computed(() => {
  switch (user.value?.role) {
    case 'client':
      return [
        { label: 'Meus chamados', to: '/chamados', icon: 'inbox' as const },
        { label: 'Conversas', to: '/conversas', icon: 'message' as const },
      ]
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

function items(): HTMLElement[] {
  return Array.from(panel.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
}

async function toggle(focusFirst = false) {
  open.value = !open.value
  if (open.value && focusFirst) {
    await nextTick()
    items()[0]?.focus()
  }
}

function close(returnFocus = false) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

function moveFocus(delta: number) {
  const list = items()
  const index = list.indexOf(document.activeElement as HTMLElement)
  list[(index + delta + list.length) % list.length]?.focus()
}

function onDocumentClick(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) close()
}

watch(open, (value) => {
  if (value) document.addEventListener('click', onDocumentClick)
  else document.removeEventListener('click', onDocumentClick)
})
watch(
  () => route.fullPath,
  () => close(),
)
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

async function signOut() {
  close()
  await session.signOut()
  await router.push({ name: 'sign-in' })
}
</script>

<template>
  <div v-if="user" ref="root" class="relative" @keydown.esc="close(true)">
    <button
      ref="trigger"
      type="button"
      class="flex items-center gap-2 rounded-pill border border-line-strong py-1 pr-3 pl-1 text-sm font-semibold text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      aria-haspopup="menu"
      :aria-label="`Menu de ${user.name}`"
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="user-menu"
      @click="toggle()"
      @keydown.down.prevent="toggle(true)"
    >
      <span
        class="grid size-7 place-items-center rounded-pill bg-accent font-mono text-[11px] font-bold text-on-accent"
        aria-hidden="true"
        >{{ initials }}</span
      >
      <span class="max-w-[16ch] truncate max-sm:hidden">{{ user.name }}</span>
      <FwIcon name="chevron-down" size="sm" />
    </button>

    <div
      v-show="open"
      id="user-menu"
      ref="panel"
      role="menu"
      aria-label="Menu do usuário"
      class="absolute top-[calc(100%+8px)] right-0 z-20 flex w-64 flex-col gap-1 rounded-md border border-line bg-surface p-2 shadow-pop"
      @keydown.down.prevent="moveFocus(1)"
      @keydown.up.prevent="moveFocus(-1)"
    >
      <div class="flex flex-col gap-1 px-2 pt-1 pb-2" role="none">
        <span class="truncate font-semibold text-ink">{{ user.name }}</span>
        <span class="truncate text-xs text-ink-muted">{{ user.email }}</span>
        <FwTag size="sm" system class="mt-1 self-start">{{ ROLE_LABEL[user.role] }}</FwTag>
      </div>
      <div class="h-px bg-line" role="separator" />
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        role="menuitem"
        class="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-ink no-underline hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none"
      >
        <FwIcon :name="link.icon" size="sm" class="text-ink-muted" />{{ link.label }}
      </RouterLink>
      <div v-if="links.length" class="h-px bg-line" role="separator" />
      <button
        type="button"
        role="menuitem"
        class="flex items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-ink hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none"
        @click="signOut"
      >
        <FwIcon name="log-out" size="sm" class="text-ink-muted" />Sair
      </button>
    </div>
  </div>
</template>
