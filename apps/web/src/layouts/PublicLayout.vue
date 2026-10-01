<script setup lang="ts">
import { FwAppHeader, FwButton, FwIconButton, FwTag } from '@f-desk/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import { useSessionStore } from '../stores/session'

/** Layout do visitante e do cliente: chatbot, chamados e conversas. */
const session = useSessionStore()
const router = useRouter()

const links = computed(() => {
  if (session.user?.role === 'client')
    return [
      { label: 'Atendimento', to: '/' },
      { label: 'Meus chamados', to: '/chamados' },
      { label: 'Conversas', to: '/conversas' },
    ]
  if (session.isStaff)
    return [
      { label: 'Atendimento', to: '/' },
      { label: 'Dashboard', to: '/tecnico' },
    ]
  return [{ label: 'Atendimento', to: '/' }]
})

async function signOut() {
  await session.signOut()
  await router.push({ name: 'chat' })
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-content flex-col gap-6 px-4 py-4 sm:px-6">
    <FwAppHeader :links="links">
      <template #actions>
        <ThemeToggle />
        <template v-if="session.user">
          <FwTag size="sm" class="max-sm:hidden">{{ session.user.name }}</FwTag>
          <FwIconButton icon="log-out" label="Sair" size="sm" @click="signOut" />
        </template>
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
