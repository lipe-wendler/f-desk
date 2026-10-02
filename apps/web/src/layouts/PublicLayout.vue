<script setup lang="ts">
import { FwAppHeader, FwButton } from '@f-desk/ui'
import { computed } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import UserMenu from '../components/UserMenu.vue'
import { useSessionStore } from '../stores/session'

/** Layout do visitante e do cliente: chatbot, chamados e conversas. */
const session = useSessionStore()

const links = computed(() => {
  if (session.user?.role === 'client')
    return [
      { label: 'Atendimento', to: '/' },
      { label: 'Meus chamados', to: '/chamados', match: '/chamados' },
      { label: 'Conversas', to: '/conversas' },
    ]
  if (session.isStaff)
    return [
      { label: 'Atendimento', to: '/' },
      { label: 'Dashboard', to: '/tecnico', match: '/tecnico' },
    ]
  return [{ label: 'Atendimento', to: '/' }]
})
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-content flex-col gap-6 px-4 py-4 sm:px-6">
    <FwAppHeader :links="links">
      <template #actions>
        <ThemeToggle />
        <UserMenu v-if="session.user" />
        <template v-else>
          <FwButton variant="ghost" size="sm" to="/entrar">Entrar</FwButton>
          <FwButton size="sm" to="/criar-conta" class="max-sm:hidden">Criar conta</FwButton>
        </template>
      </template>
    </FwAppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
