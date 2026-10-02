import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { resolveAccess } from './access'
import { routes } from './routes'

/** Altura do topo fixo da landing mais um respiro. */
const SCROLL_OFFSET = 104

function scrollMotion(): ScrollBehavior {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, _from, saved) => {
    if (saved) return saved
    // Âncoras da landing: desconta o topo fixo para o título da seção não ficar escondido.
    if (to.hash) return { el: to.hash, top: SCROLL_OFFSET, behavior: scrollMotion() }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const session = useSessionStore()
  const user = await session.load()
  return resolveAccess(to, user?.role)
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · F.Desk` : 'F.Desk'
})
