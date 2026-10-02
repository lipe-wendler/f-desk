<script setup lang="ts">
import { FwAppHeader } from '@f-desk/ui'
import { computed } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import UserMenu from '../components/UserMenu.vue'
import { useSessionStore } from '../stores/session'

/** Layout do técnico e do admin: dashboard de chamados e gestão de usuários. */
const session = useSessionStore()

const links = computed(() => [
  { label: 'Chamados', to: '/tecnico' },
  ...(session.user?.role === 'admin' ? [{ label: 'Usuários', to: '/admin/usuarios' }] : []),
])
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-content flex-col gap-6 px-4 py-4 sm:px-6">
    <FwAppHeader :links="links" home-to="/tecnico">
      <template #actions>
        <ThemeToggle />
        <UserMenu />
      </template>
    </FwAppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
