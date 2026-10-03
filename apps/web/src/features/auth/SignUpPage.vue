<script setup lang="ts">
import { fieldErrors, PASSWORD_MIN, signUpSchema } from '@f-desk/shared'
import { FwButton, FwInput, FwSectionLabel } from '@f-desk/ui'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormAlert from '../../components/FormAlert.vue'
import { useFieldErrors } from '../../composables/useFieldErrors'
import { authClient } from '../../lib/auth-client'
import { homeFor } from '../../router/access'
import { safeRedirect } from '../../router/redirect'
import { useSessionStore } from '../../stores/session'
import PendingTicketNotice from './PendingTicketNotice.vue'
import { isPendingTicket, PENDING_TICKET_REASON } from './pending-ticket'
import { authErrorMessage, isExistingAccountError } from './auth-errors'

/** Cadastro público: toda conta criada aqui é `client` (técnicos são criados pelo admin). */
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const errors = useFieldErrors(form)
const formError = ref('')
const accountExists = ref(false)
const submitting = ref(false)

const redirect = computed(() => safeRedirect(route.query.redirect))
/** Veio do cartão do chamado: a faixa avisa que falta pouco (e segue para a outra tela também). */
const pendingTicket = computed(() => isPendingTicket(route.query, redirect.value))
const signInLink = computed(() => ({
  name: 'sign-in',
  query: redirect.value
    ? {
        redirect: redirect.value,
        ...(pendingTicket.value ? { motivo: PENDING_TICKET_REASON } : {}),
      }
    : {},
}))

async function submit() {
  formError.value = ''
  accountExists.value = false
  const parsed = signUpSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }
  errors.value = {}
  submitting.value = true
  try {
    const { name, email, password } = parsed.data
    const { error } = await authClient.signUp.email({ name, email, password })
    if (error) {
      formError.value = authErrorMessage(error)
      accountExists.value = isExistingAccountError(error)
      return
    }
    const user = await session.load(true)
    await router.replace(redirect.value ?? homeFor(user?.role))
  } catch {
    formError.value = authErrorMessage(null)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-col gap-3">
      <FwSectionLabel bar>Criar conta</FwSectionLabel>
      <h1 class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em]">
        Sua conta no <span class="fw-hl">F.Desk.</span>
      </h1>
      <p class="m-0 text-ink-muted">
        Com uma conta você abre chamados e acompanha o histórico das suas conversas e chamados.
      </p>
    </header>

    <PendingTicketNotice v-if="pendingTicket" />

    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormAlert v-if="formError">
        {{ formError }}
        <RouterLink v-if="accountExists" class="font-semibold underline" :to="signInLink">
          Entrar com esse e-mail
        </RouterLink>
      </FormAlert>
      <FwInput
        v-model="form.name"
        label="Nome"
        icon="user"
        autocomplete="name"
        placeholder="Seu nome completo"
        :error="errors.name"
        required
      />
      <FwInput
        v-model="form.email"
        label="E-mail"
        type="email"
        icon="mail"
        autocomplete="email"
        inputmode="email"
        placeholder="voce@empresa.com"
        :error="errors.email"
        required
      />
      <FwInput
        v-model="form.password"
        label="Senha"
        type="password"
        autocomplete="new-password"
        placeholder="••••••••"
        revealable
        :hint="`Pelo menos ${PASSWORD_MIN} caracteres.`"
        :error="errors.password"
        required
      />
      <FwInput
        v-model="form.confirmPassword"
        label="Confirmar senha"
        type="password"
        autocomplete="new-password"
        placeholder="••••••••"
        revealable
        :error="errors.confirmPassword"
        required
      />
      <FwButton type="submit" size="lg" arrow :disabled="submitting">
        {{ submitting ? 'Criando conta…' : 'Criar conta' }}
      </FwButton>
    </form>

    <p class="m-0 text-sm text-ink-muted">
      Já tem conta?
      <RouterLink class="font-semibold text-accent-text" :to="signInLink">Entrar</RouterLink>
    </p>
    <p class="m-0 text-xs text-ink-muted">
      É técnico da F.Wendler? Sua conta é criada pelo admin da plataforma.
    </p>
  </section>
</template>
