import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChatComposer from '../ChatComposer.vue'

function mountComposer(props: Record<string, unknown> = {}) {
  return mount(ChatComposer, {
    props: { maxLength: 100, modelValue: '', ...props },
    attachTo: document.body,
  })
}

describe('barra de envio', () => {
  it('tem rótulo e dica ligados ao campo, e o Enviar começa desligado', () => {
    const w = mountComposer()
    const field = w.get('textarea')
    expect(w.get(`label[for="${field.attributes('id')}"]`).text()).toBe('Sua mensagem')
    const hint = w.get(`#${field.attributes('aria-describedby')}`)
    expect(hint.text()).toContain('Enter para enviar')
    expect(w.get('button').attributes('disabled')).toBeDefined()
  })

  it('Enter envia e Shift+Enter não', async () => {
    const w = mountComposer({ modelValue: 'oi' })
    await w.get('textarea').trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(w.emitted('submit')).toBeUndefined()
    await w.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit')).toHaveLength(1)
    await w.get('button').trigger('click')
    expect(w.emitted('submit')).toHaveLength(2)
  })

  it('não envia vazio nem enquanto responde', async () => {
    const empty = mountComposer({ modelValue: '   ' })
    await empty.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(empty.emitted('submit')).toBeUndefined()
    const busy = mountComposer({ modelValue: 'oi', sending: true })
    expect(busy.get('button').text()).toContain('Respondendo')
    expect(busy.get('button').attributes('disabled')).toBeDefined()
  })

  it('mostra o contador perto do limite e o erro ligado ao campo', () => {
    expect(mountComposer({ modelValue: 'a'.repeat(79) }).text()).not.toContain('/100')
    const near = mountComposer({ modelValue: 'a'.repeat(80), error: 'Sem conexão.' })
    expect(near.text()).toContain('80/100')
    const field = near.get('textarea')
    expect(field.attributes('aria-invalid')).toBe('true')
    expect(near.get(`#${field.attributes('aria-describedby')}`).text()).toBe('Sem conexão.')
  })
})
