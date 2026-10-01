import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { resolveAccess } from './access'
import { routes } from './routes'

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const session = useSessionStore()
  const user = await session.load()
  return resolveAccess(to, user?.role)
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · F.Desk` : 'F.Desk'
})
