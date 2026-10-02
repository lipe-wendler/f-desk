import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSessionStore } from '../../../stores/session'
import UsersPage from '../UsersPage.vue'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  setRole: vi.fn(),
  setPassword: vi.fn(),
  ban: vi.fn(),
  unban: vi.fn(),
  revokeSessions: vi.fn(),
}))
vi.mock('../users-api', () => ({ usersApi: api }))
vi.mock('../../../lib/auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

const users = [
  {
    id: 'a1',
    name: 'Felipe Wendler',
    email: 'felipe@exemplo.com',
    role: 'admin',
    banned: false,
    createdAt: '2026-10-01T10:00:00Z',
  },
  {
    id: 't1',
    name: 'Tina Técnica',
    email: 'tina@exemplo.com',
    role: 'technician',
    banned: false,
    createdAt: '2026-10-01T11:00:00Z',
  },
  {
    id: 'c1',
    name: 'Caio Cliente',
    email: 'caio@exemplo.com',
    role: 'client',
    banned: true,
    banReason: 'teste',
    createdAt: '2026-10-01T12:00:00Z',
  },
]

async function mountPage() {
  setActivePinia(createPinia())
  useSessionStore().user = {
    id: 'a1',
    name: 'Felipe Wendler',
    email: 'felipe@exemplo.com',
    role: 'admin',
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div/>' } }],
  })
  await router.push('/')
  const w = mount(UsersPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  api.list.mockResolvedValue({ data: { users, total: 3 }, error: null })
})

describe('UsersPage', () => {
  it('lista usuários com perfil e status, sem ações na própria conta', async () => {
    const w = await mountPage()
    const rows = w.findAll('li')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('Você')
    expect(rows[0]!.find('[aria-haspopup="menu"]').exists()).toBe(false)
    expect(rows[1]!.text()).toContain('Técnico')
    expect(rows[2]!.text()).toContain('Desativado')
    expect(w.text()).toContain('1–3 de 3')
    w.unmount()
  })

  it('filtra por perfil pela API', async () => {
    const w = await mountPage()
    await w.findAll('[role="tab"]')[2]!.trigger('click')
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: 'technician', page: 1 }),
    )
    w.unmount()
  })

  it('reativa acesso direto pelo menu e recarrega a lista', async () => {
    api.unban.mockResolvedValue({ data: {}, error: null })
    const w = await mountPage()
    const row = w.findAll('li')[2]!
    await row.find('[aria-haspopup="menu"]').trigger('click')
    const item = row.findAll('[role="menuitem"]').find((i) => i.text().includes('Reativar acesso'))!
    await item.trigger('click')
    await flushPromises()
    expect(api.unban).toHaveBeenCalledWith('c1')
    expect(api.list).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('mostra o erro da regra de último admin ao trocar perfil', async () => {
    api.setRole.mockResolvedValue({ data: null, error: { code: 'LAST_ADMIN', status: 400 } })
    const w = await mountPage()
    const row = w.findAll('li')[1]!
    await row.find('[aria-haspopup="menu"]').trigger('click')
    await row.findAll('[role="menuitem"]')[0]!.trigger('click')
    await flushPromises()
    const dialog = w.findAll('dialog').find((d) => d.text().includes('Alterar perfil'))!
    await dialog.findAll('input[type="radio"]')[0]!.setValue(true)
    await dialog
      .findAll('button')
      .find((b) => b.text().includes('Salvar perfil'))!
      .trigger('click')
    await flushPromises()
    expect(api.setRole).toHaveBeenCalledWith('t1', 'client')
    expect(dialog.find('[role="alert"]').text()).toBe(
      'A plataforma precisa de pelo menos um admin ativo.',
    )
    w.unmount()
  })

  it('cria conta da equipe com senha gerada e mostra o resumo', async () => {
    api.create.mockResolvedValue({ data: {}, error: null })
    const w = await mountPage()
    await w
      .findAll('button')
      .find((b) => b.text().includes('Novo usuário'))!
      .trigger('click')
    await flushPromises()
    const dialog = w.findAll('dialog').find((d) => d.text().includes('Novo usuário da equipe'))!
    const inputs = dialog.findAll('input')
    await inputs[0]!.setValue('Tito Técnico')
    await inputs[1]!.setValue(' TITO@exemplo.com ')
    await dialog.find('form').trigger('submit')
    await flushPromises()
    const sent = api.create.mock.calls[0]![0]
    expect(sent).toMatchObject({
      name: 'Tito Técnico',
      email: 'tito@exemplo.com',
      role: 'technician',
    })
    expect(sent.password).toHaveLength(14)
    expect(dialog.text()).toContain('Conta criada')
    w.unmount()
  })
})
