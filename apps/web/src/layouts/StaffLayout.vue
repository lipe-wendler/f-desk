<script setup lang="ts">
import { FwAppHeader, FwIconButton, FwTag } from '@f-desk/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import { useSessionStore } from '../stores/session'

/** Layout do técnico e do admin: dashboard de chamados e gestão de usuários. */
const session = useSessionStore()
const router = useRouter()

const links = computed(() => [
  { label: 'Chamados', to: '/tecnico' },
  ...(session.user?.role === 'admin' ? [{ label: 'Usuários', to: '/admin/usuarios' }] : []),
])

async function signOut() {
  await session.signOut()
  await router.push({ name: 'sign-in' })
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-content flex-col gap-6 px-4 py-4 sm:px-6">
    <FwAppHeader :links="links" home-to="/tecnico">
      <template #actions>
        <ThemeToggle />
        <FwTag v-if="session.user" size="sm" system class="max-sm:hidden">{{
          session.user.role
        }}</FwTag>
        <FwIconButton icon="log-out" label="Sair" size="sm" @click="signOut" />
      </template>
    </FwAppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
