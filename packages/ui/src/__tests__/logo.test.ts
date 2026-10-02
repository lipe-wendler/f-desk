import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FwLogo from '../components/FwLogo.vue'
import { LOGO_VIEWBOX, SYMBOL_VIEWBOX } from '../components/logo-paths'

describe('FwLogo', () => {
  it('mostra a logo completa com nome acessível', () => {
    const w = mount(FwLogo)
    expect(w.attributes('role')).toBe('img')
    expect(w.attributes('aria-label')).toBe('F.Desk')
    expect(w.attributes('viewBox')).toBe(LOGO_VIEWBOX)
    expect(w.find('.fw-logo-text').exists()).toBe(true)
    expect(w.find('.fw-logo-dot').exists()).toBe(true)
  })

  it('no símbolo mostra só o cubo', () => {
    const w = mount(FwLogo, { props: { variant: 'symbol' } })
    expect(w.attributes('viewBox')).toBe(SYMBOL_VIEWBOX)
    expect(w.findAll('path')).toHaveLength(3)
    expect(w.find('.fw-logo-text').exists()).toBe(false)
  })

  it('decorativa some para leitores de tela', () => {
    const w = mount(FwLogo, { props: { decorative: true } })
    expect(w.attributes('aria-hidden')).toBe('true')
    expect(w.attributes('role')).toBeUndefined()
    expect(w.attributes('aria-label')).toBeUndefined()
  })

  it('aplica mono e altura', () => {
    const w = mount(FwLogo, { props: { mono: true, height: 48 } })
    expect(w.classes()).toContain('fw-logo-mono')
    expect(w.attributes('style')).toContain('height: 48px')
  })
})
