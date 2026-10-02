import { fieldErrors, signInSchema, signUpSchema } from '@f-desk/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { authErrorMessage } from '../auth-errors'
import SignInPage from '../SignInPage.vue'
import SignUpPage from '../SignUpPage.vue'

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('../../../lib/auth-client', () => ({
  authClient: {
    signIn: { email: auth.signIn },
    signUp: { email: auth.signUp },
    getSession: auth.getSession,
    signOut: vi.fn(),
  },
}))

const stub = { template: '<div />' }

async function mountAt(component: object, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'chat', component: stub },
      { path: '/entrar', name: 'sign-in', component: stub },
      { path: '/criar-conta', name: 'sign-up', component: stub },
      { path: '/chamados/novo', name: 'ticket-new', component: stub },
      { path: '/tecnico', name: 'staff-dashboard', component: stub },
    ],
  })
  await router.push(path)
  const wrapper = mount(component, { global: { plugins: [router] } })
  return { wrapper, router }
}

const sessionOf = (role: string) => ({
  data: { user: { id: '1', name: 'Ana Souza', email: 'ana@exemplo.com', role } },
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('schemas de auth', () => {
  it('normaliza o e-mail e exige senhas iguais no cadastro', () => {
    const ok = signUpSchema.safeParse({
      name: ' Ana ',
      email: ' ANA@Exemplo.com ',
      password: '12345678',
      confirmPassword: '12345678',
    })
    expect(ok.success && ok.data.email).toBe('ana@exemplo.com')
    const bad = signUpSchema.safeParse({
      name: 'Ana',
      email: 'ana@exemplo.com',
      password: '12345678',
      confirmPassword: 'x',
    })
    expect(bad.success).toBe(false)
    expect(fieldErrors(bad.error!).confirmPassword).toBe('As senhas não conferem.')
  })

  it('exige e-mail válido e senha no login', () => {
    const r = signInSchema.safeParse({ email: 'x', password: '' })
    expect(fieldErrors(r.error!)).toEqual({
      email: 'Informe um e-mail válido.',
      password: 'Informe sua senha.',
    })
  })
})

describe('authErrorMessage', () => {
  it('traduz os códigos do better-auth', () => {
    expect(authErrorMessage({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'E-mail ou senha incorretos.',
    )
    expect(authErrorMessage({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toBe(
      'Já existe uma conta com esse e-mail.',
    )
    expect(authErrorMessage({ status: 429 })).toMatch(/Muitas tentativas/)
    expect(authErrorMessage({ code: 'QUALQUER' })).toMatch(/Não foi possível/)
  })
})

describe('SignInPage', () => {
  it('mostra os erros de validação sem chamar a API', async () => {
    const { wrapper } = await mountAt(SignInPage, '/entrar')
    await wrapper.find('form').trigger('submit')
    expect(auth.signIn).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Informe um e-mail válido.')
    expect(wrapper.text()).toContain('Informe sua senha.')
  })

  it('mostra a mensagem de credencial inválida', async () => {
    auth.signIn.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 },
    })
    const { wrapper, router } = await mountAt(SignInPage, '/entrar')
    await wrapper.find('input[type="email"]').setValue('ana@exemplo.com')
    await wrapper.find('input[type="password"]').setValue('errada123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('E-mail ou senha incorretos.')
    expect(router.currentRoute.value.path).toBe('/entrar')
  })

  it('volta para o redirect depois do login', async () => {
    auth.signIn.mockResolvedValue({ data: {}, error: null })
    auth.getSession.mockResolvedValue(sessionOf('client'))
    const { wrapper, router } = await mountAt(SignInPage, '/entrar?redirect=/chamados/novo')
    await wrapper.find('input[type="email"]').setValue('ana@exemplo.com')
    await wrapper.find('input[type="password"]').setValue('12345678')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(auth.signIn).toHaveBeenCalledWith({ email: 'ana@exemplo.com', password: '12345678' })
    expect(router.currentRoute.value.fullPath).toBe('/chamados/novo')
  })

  it('leva técnico para o dashboard e ignora redirect externo', async () => {
    auth.signIn.mockResolvedValue({ data: {}, error: null })
    auth.getSession.mockResolvedValue(sessionOf('technician'))
    const { wrapper, router } = await mountAt(SignInPage, '/entrar?redirect=//evil.com')
    await wrapper.find('input[type="email"]').setValue('tec@exemplo.com')
    await wrapper.find('input[type="password"]').setValue('12345678')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/tecnico')
  })
})

describe('SignUpPage', () => {
  async function fill(
    wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper'],
    confirm = 'segredo123',
  ) {
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('Ana Souza')
    await inputs[1]!.setValue('ana@exemplo.com')
    await inputs[2]!.setValue('segredo123')
    await inputs[3]!.setValue(confirm)
  }

  it('bloqueia senhas diferentes', async () => {
    const { wrapper } = await mountAt(SignUpPage, '/criar-conta')
    await fill(wrapper, 'outra-senha')
    await wrapper.find('form').trigger('submit')
    expect(auth.signUp).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('As senhas não conferem.')
  })

  it('cria a conta sem enviar confirmPassword e volta para o redirect', async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: null })
    auth.getSession.mockResolvedValue(sessionOf('client'))
    const { wrapper, router } = await mountAt(SignUpPage, '/criar-conta?redirect=/chamados/novo')
    await fill(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(auth.signUp).toHaveBeenCalledWith({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'segredo123',
    })
    expect(router.currentRoute.value.fullPath).toBe('/chamados/novo')
  })

  it('oferece entrar quando o e-mail já tem conta', async () => {
    auth.signUp.mockResolvedValue({
      data: null,
      error: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', status: 422 },
    })
    const { wrapper } = await mountAt(SignUpPage, '/criar-conta?redirect=/chamados/novo')
    await fill(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const alert = wrapper.find('[role="alert"]')
    expect(alert.text()).toContain('Já existe uma conta com esse e-mail.')
    expect(alert.find('a').attributes('href')).toBe('/entrar?redirect=/chamados/novo')
  })
})

describe('erros por campo', () => {
  it('somem quando o campo é corrigido', async () => {
    const { wrapper } = await mountAt(SignInPage, '/entrar')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Informe um e-mail válido.')
    await wrapper.find('input[type="email"]').setValue('ana@exemplo.com')
    expect(wrapper.text()).not.toContain('Informe um e-mail válido.')
    expect(wrapper.text()).toContain('Informe sua senha.')
  })
})
