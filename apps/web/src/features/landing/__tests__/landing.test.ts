import { flushPromises, mount } from '@vue/test-utils'
import axe from 'axe-core'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import LandingLayout from '../../../layouts/LandingLayout.vue'
import { splitHighlight } from '../highlight'
import { landing } from '../landing-content'
import LandingPage from '../LandingPage.vue'
import { formatBRL, planPrice, yearlyPerMonth } from '../pricing'

vi.mock('../../../lib/auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

const stub = { template: '<div />' }

async function mountLanding() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: LandingLayout,
        children: [{ path: '', name: 'landing', component: LandingPage }],
      },
      { path: '/atendimento', name: 'chat', component: stub },
      { path: '/entrar', name: 'sign-in', component: stub },
      { path: '/criar-conta', name: 'sign-up', component: stub },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(
    { template: '<RouterView />' },
    {
      global: { plugins: [router] },
      attachTo: document.body,
    },
  )
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  document.body.innerHTML = ''
})

describe('landing page', () => {
  it('tem um h1 só e as seções das âncoras do topo', async () => {
    const { wrapper } = await mountLanding()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    for (const item of landing.nav) expect(wrapper.find(`section#${item.id}`).exists()).toBe(true)
    expect(wrapper.find('main#conteudo').exists()).toBe(true)
  })

  it('leva ao atendimento e aos planos', async () => {
    const { wrapper } = await mountLanding()
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/atendimento')
    expect(hrefs).toContain('/#planos')
    // Âncoras não se marcam como página atual (o RouterLink comum ignora o hash).
    const anchors = wrapper.findAll('a[href^="/#"]')
    expect(anchors.length).toBeGreaterThan(0)
    for (const a of anchors) expect(a.attributes('aria-current')).toBeUndefined()
  })

  it('troca os preços entre mensal e anual e destaca o Pro', async () => {
    const { wrapper } = await mountLanding()
    const pro = () => wrapper.findAll('.landing-plan').find((p) => p.text().includes('Pro'))!
    expect(pro().classes()).toContain('landing-plan-featured')
    expect(pro().text()).toContain('Mais escolhido')
    expect(pro().text()).toContain('R$ 149')
    expect(pro().text()).toContain('/mês')

    await wrapper.find('input[value="yearly"]').setValue()
    expect(pro().text()).toContain('R$ 1.490')
    expect(pro().text()).toContain('/ano')
    expect(pro().text()).toContain('equivale a R$ 124/mês')
    expect(wrapper.text()).toContain('Mostrando preços do plano anual.')
  })

  it('pausa e retoma a faixa de palavras', async () => {
    const { wrapper } = await mountLanding()
    const toggle = wrapper.find('.landing-marquee-toggle')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.landing-marquee').classes()).toContain('is-paused')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('false')
  })

  it('abre e fecha o menu do celular, devolvendo o foco ao botão com Esc', async () => {
    const { wrapper } = await mountLanding()
    const button = wrapper.find('button[aria-controls="menu-da-pagina"]')
    const menu = wrapper.find('#menu-da-pagina')
    expect(menu.isVisible()).toBe(false)
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(menu.isVisible()).toBe(true)
    await wrapper.find('header').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(menu.isVisible()).toBe(false)
    expect(document.activeElement).toBe(button.element)
  })

  it('não tem violações de acessibilidade detectáveis pelo axe', async () => {
    const { wrapper } = await mountLanding()
    const result = await axe.run(wrapper.element as HTMLElement, {
      // happy-dom não calcula cores: o contraste é coberto pelo check:contrast do design system.
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})

describe('helpers da landing', () => {
  it('separa os trechos destacados', () => {
    expect(splitHighlight('Resolver *de verdade.*')).toEqual([
      { text: 'Resolver ', hl: false },
      { text: 'de verdade.', hl: true },
    ])
  })

  it('calcula e formata os preços', () => {
    const pro = landing.pricing.plans.find((p) => p.id === 'pro')!
    expect(planPrice(pro, 'monthly')).toBe(149)
    expect(planPrice(pro, 'yearly')).toBe(1490)
    expect(yearlyPerMonth(pro)).toBe(124)
    expect(formatBRL(1490)).toBe('R$ 1.490')
  })
})
