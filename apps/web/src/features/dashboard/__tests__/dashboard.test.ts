import type { StaffTicketDetail, StaffTicketSummary } from '@f-desk/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSessionStore } from '../../../stores/session'
import DashboardPage from '../DashboardPage.vue'
import StaffTicketPage from '../StaffTicketPage.vue'

vi.mock('../../../lib/auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

const stub = { template: '<div />' }
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function mockApi(routes: Record<string, (body: unknown) => Response>) {
  const calls: { key: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url.replace(/^\/api/, '')}`
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ key, body })
      const match = Object.entries(routes).find(([k]) => key.startsWith(k))
      return match ? match[1](body) : jsonResponse({ error: 'sem rota no teste' }, 500)
    }),
  )
  return calls
}

async function mountAt(component: object, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tecnico', name: 'staff-dashboard', component: stub },
      { path: '/tecnico/chamados/:id', name: 'staff-ticket', component: stub },
    ],
  })
  await router.push(path)
  const wrapper = mount(component, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const metrics = {
  open: 3,
  inProgress: 2,
  waitingClient: 1,
  unassigned: 2,
  mine: 1,
  resolvedThisWeek: 5,
}
const row: StaffTicketSummary = {
  code: 'TKT-0007',
  subject: 'VPN não conecta',
  status: 'open',
  priority: 'urgent',
  createdAt: '2026-10-02T12:00:00.000Z',
  updatedAt: '2026-10-02T12:00:00.000Z',
  client: { name: 'Ana Souza', email: 'ana@exemplo.com' },
  assignee: null,
}

beforeEach(() => {
  setActivePinia(createPinia())
  useSessionStore().user = { id: 't1', name: 'Téo', email: 'teo@exemplo.com', role: 'technician' }
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('DashboardPage', () => {
  it('mostra métricas e a fila, e filtra por fila, prioridade e busca', async () => {
    const calls = mockApi({
      'GET /staff/metrics': () => jsonResponse(metrics),
      'GET /staff/tickets?': () => jsonResponse({ tickets: [row], total: 1 }),
    })
    const wrapper = await mountAt(DashboardPage, '/tecnico')
    expect(wrapper.text()).toContain('Resolvidos em 7 dias')
    expect(wrapper.text()).toContain('Meus (1)')
    expect(wrapper.get('[data-testid="queue"]').text()).toContain('Ana Souza')
    expect(wrapper.get('[data-testid="queue"]').text()).toContain('Sem responsável')

    const tabs = wrapper.findAll('[role="tab"]')
    await tabs.find((t) => t.text().startsWith('Sem responsável'))!.trigger('click')
    await flushPromises()
    expect(calls.filter((c) => c.key.startsWith('GET /staff/tickets')).at(-1)!.key).toContain(
      'queue=unassigned',
    )

    await wrapper.get('select').setValue('urgent')
    await flushPromises()
    expect(calls.filter((c) => c.key.startsWith('GET /staff/tickets')).at(-1)!.key).toContain(
      'priority=urgent',
    )

    await wrapper.get('input').setValue('vpn')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(calls.filter((c) => c.key.startsWith('GET /staff/tickets')).at(-1)!.key).toContain(
      'search=vpn',
    )
  })
})

describe('StaffTicketPage', () => {
  const detail = (over: Partial<StaffTicketDetail> = {}): StaffTicketDetail => ({
    ...row,
    description: 'Erro de autenticação.',
    resolvedAt: null,
    closedAt: null,
    messages: [
      {
        id: 1,
        content: 'Checar o certificado da VPN',
        internal: true,
        createdAt: '2026-10-02T12:10:00.000Z',
        author: { id: 't2', name: 'Bia', role: 'technician' },
      },
    ],
    transcript: [{ role: 'user', content: 'a vpn não conecta', source: null }],
    ...over,
  })

  it('mostra notas internas, só os status permitidos e assume o chamado', async () => {
    let current = detail()
    const calls = mockApi({
      'GET /staff/assignees': () =>
        jsonResponse({ assignees: [{ id: 't1', name: 'Téo', role: 'technician' }] }),
      'GET /staff/tickets/TKT-0007': () => jsonResponse(current),
      'PATCH /staff/tickets/TKT-0007': () => {
        current = detail({ assignee: { id: 't1', name: 'Téo' } })
        return jsonResponse({ ok: true })
      },
    })
    const wrapper = await mountAt(StaffTicketPage, '/tecnico/chamados/TKT-0007')
    expect(wrapper.get('[data-testid="thread"]').text()).toContain('Nota interna')
    expect(wrapper.text()).toContain('a vpn não conecta')

    const status = wrapper.findAll('select')[0]!
    expect(status.findAll('option').map((o) => o.text())).toEqual([
      'Aberto',
      'Em atendimento',
      'Aguardando cliente',
      'Resolvido',
      'Fechado',
    ])

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Assumir chamado')!
      .trigger('click')
    await flushPromises()
    expect(calls.find((c) => c.key.startsWith('PATCH'))!.body).toEqual({ assigneeId: 't1' })
    expect(wrapper.findAll('button').some((b) => b.text() === 'Assumir chamado')).toBe(false)
  })

  it('envia nota interna e resposta ao cliente', async () => {
    const calls = mockApi({
      'GET /staff/assignees': () => jsonResponse({ assignees: [] }),
      'GET /staff/tickets/TKT-0007': () => jsonResponse(detail()),
      'POST /staff/tickets/TKT-0007/messages': () =>
        jsonResponse({ status: 'in_progress', assigneeId: 't1' }, 201),
    })
    const wrapper = await mountAt(StaffTicketPage, '/tecnico/chamados/TKT-0007')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('textarea').setValue('Cliente usa Windows 11')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(calls.find((c) => c.key.startsWith('POST'))!.body).toEqual({
      content: 'Cliente usa Windows 11',
      internal: true,
    })
  })

  it('chamado fechado fica só leitura', async () => {
    mockApi({
      'GET /staff/assignees': () => jsonResponse({ assignees: [] }),
      'GET /staff/tickets/TKT-0007': () => jsonResponse(detail({ status: 'closed' })),
    })
    const wrapper = await mountAt(StaffTicketPage, '/tecnico/chamados/TKT-0007')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.text()).toContain('só leitura')
    expect(wrapper.findAll('select').every((s) => s.attributes('disabled') !== undefined)).toBe(
      true,
    )
  })
})
