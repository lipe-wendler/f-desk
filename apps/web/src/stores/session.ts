import { isRole, type Role } from '@f-desk/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authClient } from '../lib/auth-client'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
}

/** Sessão do usuário logado (ou null para visitantes). */
export const useSessionStore = defineStore('session', () => {
  const user = ref<SessionUser | null>(null)
  const loaded = ref(false)

  async function load(force = false) {
    if (loaded.value && !force) return user.value
    try {
      const { data } = await authClient.getSession()
      const u = data?.user
      user.value =
        u && isRole(u.role) ? { id: u.id, name: u.name, email: u.email, role: u.role } : null
    } catch {
      user.value = null
    }
    loaded.value = true
    return user.value
  }

  async function signOut() {
    await authClient.signOut()
    user.value = null
  }

  const isStaff = computed(() => user.value?.role === 'technician' || user.value?.role === 'admin')

  return { user, loaded, isStaff, load, signOut }
})
