import type { Role } from '@f-desk/shared'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { resolveAccess } from '../access'
import { routes } from '../routes'

const router = createRouter({ history: createMemoryHistory(), routes })
const check = (path: string, role?: Role) => resolveAccess(router.resolve(path), role)

describe('acesso às rotas por perfil', () => {
  it('visitante vê a landing, usa o chat e as telas de login sem conta', () => {
    expect(check('/')).toBe(true)
    expect(check('/atendimento')).toBe(true)
    expect(check('/entrar')).toBe(true)
    expect(check('/criar-conta')).toBe(true)
  })

  it('visitante que tenta ver chamados vai para o login e volta depois', () => {
    expect(check('/chamados/TKT-0001')).toEqual({
      name: 'sign-in',
      query: { redirect: '/chamados/TKT-0001' },
    })
    expect(check('/chamados')).toEqual({ name: 'sign-in', query: { redirect: '/chamados' } })
    expect(check('/tecnico')).toEqual({ name: 'sign-in', query: { redirect: '/tecnico' } })
  })

  it('cliente acessa os chamados, mas não o dashboard nem a gestão de usuários', () => {
    expect(check('/chamados', 'client')).toBe(true)
    expect(check('/chamados/TKT-0001', 'client')).toBe(true)
    expect(check('/tecnico', 'client')).toEqual({ name: 'forbidden' })
    expect(check('/admin/usuarios', 'client')).toEqual({ name: 'forbidden' })
  })

  it('técnico acessa o dashboard, mas não a gestão de usuários', () => {
    expect(check('/tecnico', 'technician')).toBe(true)
    expect(check('/tecnico/chamados/42', 'technician')).toBe(true)
    expect(check('/admin/usuarios', 'technician')).toEqual({ name: 'forbidden' })
  })

  it('admin acessa dashboard e gestão de usuários', () => {
    expect(check('/tecnico', 'admin')).toBe(true)
    expect(check('/admin/usuarios', 'admin')).toBe(true)
  })

  it('a landing fica em / e o atendimento em /atendimento, abertos a qualquer perfil', () => {
    expect(router.resolve('/').name).toBe('landing')
    expect(router.resolve('/atendimento').name).toBe('chat')
    expect(check('/', 'client')).toBe(true)
    expect(check('/', 'technician')).toBe(true)
    expect(check('/atendimento', 'client')).toBe(true)
  })

  it('abrir chamado e conversas antigas levam ao atendimento (o chamado nasce no chat)', async () => {
    const nav = createRouter({ history: createMemoryHistory(), routes })
    await nav.push('/chamados/novo')
    expect(nav.currentRoute.value.name).toBe('chat')
    await nav.push('/conversas')
    expect(nav.currentRoute.value.name).toBe('chat')
  })

  it('usuário logado que abre entrar/criar conta vai para a página inicial do perfil', () => {
    expect(check('/entrar', 'client')).toEqual({ name: 'chat' })
    expect(check('/criar-conta', 'technician')).toEqual({ name: 'staff-dashboard' })
  })
})
