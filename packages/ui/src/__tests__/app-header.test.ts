import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import FwAppHeader from '../components/FwAppHeader.vue'

const Empty = { render: () => null }

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tecnico', component: Empty },
      { path: '/tecnico/chamados/:id', component: Empty },
      { path: '/tecnicos', component: Empty },
      { path: '/admin/usuarios', component: Empty },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(FwAppHeader, {
    props: {
      links: [
        { label: 'Chamados', to: '/tecnico', match: '/tecnico' },
        { label: 'Usuários', to: '/admin/usuarios' },
      ],
    },
    global: { plugins: [router] },
  })
  const current = () =>
    w
      .findAll('nav a')
      .filter((a) => a.attributes('aria-current') === 'page')
      .map((a) => a.text())
  return { w, current }
}

describe('FwAppHeader', () => {
  it('marca o link da rota exata', async () => {
    const { current } = await mountAt('/admin/usuarios')
    expect(current()).toEqual(['Usuários'])
  })

  it('com match, marca o link nas rotas abaixo do prefixo', async () => {
    const { current } = await mountAt('/tecnico/chamados/TKT-0007')
    expect(current()).toEqual(['Chamados'])
  })

  it('não confunde prefixo com início de outra palavra', async () => {
    const { current } = await mountAt('/tecnicos')
    expect(current()).toEqual([])
  })

  it('mostra a logo como link para a página inicial', async () => {
    const { w } = await mountAt('/admin/usuarios')
    const brand = w.find('a.fw-header-brand')
    expect(brand.attributes('href')).toBe('/')
    expect(brand.find('svg[role="img"]').attributes('aria-label')).toBe('F.Desk')
  })

  it('renderiza links com href e navega pelo router', async () => {
    const { w, current } = await mountAt('/admin/usuarios')
    const link = w.findAll('nav a')[0]!
    expect(link.attributes('href')).toBe('/tecnico')
    await link.trigger('click')
    await new Promise((r) => setTimeout(r))
    expect(current()).toEqual(['Chamados'])
  })
})
