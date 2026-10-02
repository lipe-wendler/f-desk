<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'
import { useTemplateRef } from 'vue'
import { useDropdownMenu } from '../../composables/useDropdownMenu'
import type { AdminUser } from './users-api'

export type UserAction = 'role' | 'password' | 'sessions' | 'ban' | 'unban'

defineProps<{ user: AdminUser }>()
const emit = defineEmits<{ action: [action: UserAction] }>()

const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const { open, toggle, close, moveFocus } = useDropdownMenu(root, trigger)

function pick(action: UserAction) {
  close()
  emit('action', action)
}
</script>

<template>
  <div ref="root" class="relative" @keydown.esc="close(true)">
    <button
      ref="trigger"
      type="button"
      class="fw-iconbtn fw-iconbtn-sm"
      :aria-label="`Ações para ${user.name}`"
      aria-haspopup="menu"
      :aria-expanded="open ? 'true' : 'false'"
      @click="toggle()"
      @keydown.down.prevent="toggle(true)"
    >
      <FwIcon name="more" />
    </button>
    <div
      v-show="open"
      role="menu"
      :aria-label="`Ações para ${user.name}`"
      class="absolute top-[calc(100%+6px)] right-0 z-20 flex w-56 flex-col gap-1 rounded-md border border-line bg-surface p-2 shadow-pop"
      @keydown.down.prevent="moveFocus(1)"
      @keydown.up.prevent="moveFocus(-1)"
    >
      <button type="button" role="menuitem" class="menu-item" @click="pick('role')">
        <FwIcon name="users" size="sm" />Alterar perfil
      </button>
      <button type="button" role="menuitem" class="menu-item" @click="pick('password')">
        <FwIcon name="key" size="sm" />Redefinir senha
      </button>
      <button type="button" role="menuitem" class="menu-item" @click="pick('sessions')">
        <FwIcon name="log-out" size="sm" />Encerrar sessões
      </button>
      <div class="h-px bg-line" role="separator" />
      <button
        v-if="user.banned"
        type="button"
        role="menuitem"
        class="menu-item"
        @click="pick('unban')"
      >
        <FwIcon name="check" size="sm" />Reativar acesso
      </button>
      <button
        v-else
        type="button"
        role="menuitem"
        class="menu-item text-danger"
        @click="pick('ban')"
      >
        <FwIcon name="alert" size="sm" />Desativar acesso
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink);
  font: 400 14px/20px var(--font-sans);
  text-align: left;
  cursor: pointer;
}
.menu-item.text-danger {
  color: var(--danger);
}
.menu-item:hover,
.menu-item:focus-visible {
  background: var(--surface-raised);
  outline: none;
}
</style>
