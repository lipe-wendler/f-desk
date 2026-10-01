import 'vue-router'
import type { Role } from '@f-desk/shared'

declare module 'vue-router' {
  interface RouteMeta {
    /** Perfis com acesso. Ausente = rota pública. */
    roles?: readonly Role[]
    /** Só para quem não está logado (entrar, criar conta). */
    guestOnly?: boolean
    title?: string
  }
}
