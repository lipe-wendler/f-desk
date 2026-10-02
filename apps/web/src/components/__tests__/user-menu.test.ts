import type { Role } from '@f-desk/shared'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSessionStore } from '../../stores/session'
import UserMenu from '../UserMenu.vue'

vi.mock('../../lib/auth-client', () => ({ authClient: { getSession: vi.fn(), signOut: vi.fn() } }))

const stub = { template: '<div />' }

async function mountAs(role: Role) {
  setActivePinia(createPinia())
  useSessionStore().user = { id: '1', name: 'Ana Souza', email: 'ana@exemplo.com', role }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/entrar', '/chamados', '/conversas', '/tecnico', '/admin/usuarios'].map(
      (path) => ({ path, component: stub }),
    ),
  })
  router.addRoute({ path: '/login', name: 'sign-in', component: stub })
  await router.push('/')
  return mount(UserMenu, { global: { plugins: [router] }, attachTo: document.body })
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('UserMenu', () => {
  it('mostra iniciais e abre/fecha com clique e Esc', async () => {
    const w = await mountAs('client')
    const trigger = w.find('button[aria-haspopup="menu"]')
    expect(trigger.text()).toContain('AS')
    expect(w.find('[role="menu"]').isVisible()).toBe(false)
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(w.find('[role="menu"]').isVisible()).toBe(true)
    await w.find('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(trigger.attributes('aria-expanded')).toBe('false')
    w.unmount()
  })

  it.each([
    ['client', 'Cliente', ['Meus chamados', 'Conversas', 'Sair']],
    ['technician', 'Técnico', ['Dashboard', 'Sair']],
    ['admin', 'Admin', ['Dashboard', 'Usuários', 'Sair']],
  ] as const)('perfil %s mostra os atalhos certos', async (role, label, items) => {
    const w = await mountAs(role)
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    expect(w.find('[role="menu"]').text()).toContain(label)
    expect(w.findAll('[role="menuitem"]').map((i) => i.text())).toEqual(items)
    w.unmount()
  })
})
