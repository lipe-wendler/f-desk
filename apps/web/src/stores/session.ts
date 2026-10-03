import { isRole, type Role } from '@f-desk/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authClient } from '../lib/auth-client'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  /** Foto de perfil (campo `image` do better-auth); sem ela, o avatar usa as iniciais. */
  image?: string | null
}

/** Sessão do usuário logado (ou null para visitantes). */
export const useSessionStore = defineStore('session', () => {
  const user = ref<SessionUser | null>(null)
  const loaded = ref(false)
  /** Conferindo a sessão com o servidor de novo (`refresh`). */
  const checking = ref(false)

  async function load(force = false) {
    if (loaded.value && !force) return user.value
    try {
      const { data, error } = await authClient.getSession()
      // Falha ao conferir (rede, servidor) depois da primeira carga: mantém o que já se sabia.
      if (error && loaded.value) return user.value
      const u = data?.user
      user.value =
        u && isRole(u.role)
          ? { id: u.id, name: u.name, email: u.email, role: u.role, image: u.image ?? null }
          : null
    } catch {
      if (!loaded.value) user.value = null
    }
    loaded.value = true
    return user.value
  }

  /**
   * Confere a sessão de novo. A tela carrega a sessão uma vez, e ela pode ter acabado ou mudado
   * depois (saída em outra aba, prazo vencido, sessão encerrada pelo admin).
   */
  async function refresh() {
    checking.value = true
    try {
      return await load(true)
    } finally {
      checking.value = false
    }
  }

  async function signOut() {
    await authClient.signOut()
    user.value = null
  }

  const isStaff = computed(() => user.value?.role === 'technician' || user.value?.role === 'admin')

  return { user, loaded, checking, isStaff, load, refresh, signOut }
})
