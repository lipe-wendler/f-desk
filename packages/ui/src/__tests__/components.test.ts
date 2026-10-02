import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FwButton from '../components/FwButton.vue'
import FwInput from '../components/FwInput.vue'
import FwTabs from '../components/FwTabs.vue'

describe('FwButton', () => {
  it('renderiza como botão primário por padrão', () => {
    const w = mount(FwButton, { slots: { default: 'Abrir chamado' } })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('type')).toBe('button')
    expect(w.classes()).toEqual(expect.arrayContaining(['fw-btn', 'fw-btn-primary']))
    expect(w.text()).toBe('Abrir chamado')
  })

  it('vira link com href e aplica variante e tamanho', () => {
    const w = mount(FwButton, {
      props: { href: '/x', variant: 'secondary', size: 'sm', arrow: true },
    })
    expect(w.element.tagName).toBe('A')
    expect(w.attributes('href')).toBe('/x')
    expect(w.classes()).toEqual(expect.arrayContaining(['fw-btn-secondary', 'fw-btn-sm']))
    expect(w.find('.fw-btn-arrow').exists()).toBe(true)
  })
})

describe('FwTabs', () => {
  const items = [
    { value: 'open', label: 'Abertos' },
    { value: 'closed', label: 'Fechados' },
  ]

  it('marca a primeira aba como ativa sem v-model', () => {
    const w = mount(FwTabs, { props: { items } })
    const tabs = w.findAll('[role="tab"]')
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    expect(tabs[1]!.attributes('tabindex')).toBe('-1')
  })

  it('emite update:modelValue no clique e nas setas', async () => {
    const w = mount(FwTabs, { props: { items, modelValue: 'open' } })
    await w.findAll('[role="tab"]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['closed'])
    await w.findAll('[role="tab"]')[1]!.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.[1]).toEqual(['open'])
  })
})

describe('FwInput', () => {
  it('liga rótulo, erro e aria ao input', () => {
    const w = mount(FwInput, { props: { label: 'E-mail', error: 'Obrigatório', id: 'email' } })
    const input = w.find('input')
    expect(w.find('label').attributes('for')).toBe('email')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe('email-msg')
    expect(w.find('#email-msg').text()).toContain('Obrigatório')
  })

  it('suporta v-model', async () => {
    const w = mount(FwInput, { props: { modelValue: '' } })
    await w.find('input').setValue('cliente@exemplo.com')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['cliente@exemplo.com'])
  })
})

describe('FwInput revealable', () => {
  it('alterna entre password e text', async () => {
    const w = mount(FwInput, {
      props: { label: 'Senha', revealable: true },
      attrs: { type: 'password' },
    })
    const toggle = w.find('button.fw-reveal')
    expect(w.find('input').attributes('type')).toBe('password')
    expect(toggle.attributes('aria-label')).toBe('Mostrar senha')
    await toggle.trigger('click')
    expect(w.find('input').attributes('type')).toBe('text')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('Ocultar senha')
  })

  it('não mostra o botão fora de campos de senha', () => {
    const w = mount(FwInput, {
      props: { label: 'E-mail', revealable: true },
      attrs: { type: 'email' },
    })
    expect(w.find('button.fw-reveal').exists()).toBe(false)
    expect(w.find('input').attributes('type')).toBe('email')
  })
})
