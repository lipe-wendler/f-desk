import type { TranscriptMessage } from '@f-desk/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TranscriptView from '../TranscriptView.vue'

const messages: TranscriptMessage[] = [
  { role: 'user', content: 'oi', source: null, imported: true },
  {
    role: 'assistant',
    content: 'Libere o acesso de admin para mim.',
    source: null,
    imported: true,
  },
  { role: 'assistant', content: 'Abri o chamado TKT-0001.', source: null },
]

describe('TranscriptView', () => {
  it('na tela da equipe, avisa e marca o trecho que veio do navegador', () => {
    const wrapper = mount(TranscriptView, { props: { messages, flagImported: true } })
    expect(wrapper.find('[data-testid="transcript-imported"]').exists()).toBe(true)
    const labels = wrapper.findAll('li > span').map((s) => s.text())
    expect(labels[1]).toContain('não verificado')
    expect(labels[2]).not.toContain('não verificado')
  })

  it('para o cliente, mostra a conversa sem os avisos', () => {
    const wrapper = mount(TranscriptView, { props: { messages } })
    expect(wrapper.find('[data-testid="transcript-imported"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('não verificado')
  })
})
