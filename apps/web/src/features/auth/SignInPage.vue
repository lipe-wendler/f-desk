<script setup lang="ts">
import { fieldErrors, signInSchema } from '@f-desk/shared'
import { FwButton, FwInput, FwSectionLabel } from '@f-desk/ui'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormAlert from '../../components/FormAlert.vue'
import { authClient } from '../../lib/auth-client'
import { homeFor } from '../../router/access'
import { safeRedirect } from '../../router/redirect'
import { useSessionStore } from '../../stores/session'
import { authErrorMessage } from './auth-errors'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const form = reactive({ email: '', password: '' })
const errors = ref<Record<string, string>>({})
const formError = ref('')
const submitting = ref(false)

const redirect = computed(() => safeRedirect(route.query.redirect))
const signUpLink = computed(() => ({
  name: 'sign-up',
  query: redirect.value ? { redirect: redirect.value } : {},
}))

async function submit() {
  formError.value = ''
  const parsed = signInSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }
  errors.value = {}
  submitting.value = true
  try {
    const { error } = await authClient.signIn.email(parsed.data)
    if (error) {
      formError.value = authErrorMessage(error)
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
      <FwSectionLabel bar>Entrar</FwSectionLabel>
      <h1 class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em]">
        Entre na sua <span class="fw-hl">conta.</span>
      </h1>
      <p class="m-0 text-ink-muted">
        {{
          redirect
            ? 'Entre para continuar de onde parou.'
            : 'Entre para abrir chamados e acompanhar seu histórico.'
        }}
      </p>
    </header>

    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormAlert v-if="formError">{{ formError }}</FormAlert>
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
        autocomplete="current-password"
        revealable
        :error="errors.password"
        required
      />
      <FwButton type="submit" size="lg" arrow :disabled="submitting">
        {{ submitting ? 'Entrando…' : 'Entrar' }}
      </FwButton>
    </form>

    <p class="m-0 text-sm text-ink-muted">
      Ainda não tem conta?
      <RouterLink class="font-semibold text-accent-text" :to="signUpLink">Criar conta</RouterLink>
    </p>
  </section>
</template>
