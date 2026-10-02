<script setup lang="ts">
import { fieldErrors, setPasswordSchema } from '@f-desk/shared'
import { FwButton, FwCheckbox, FwDialog } from '@f-desk/ui'
import { ref, watch } from 'vue'
import FormAlert from '../../components/FormAlert.vue'
import { useToast } from '../../composables/useToast'
import { generatePassword } from '../../lib/password'
import { authErrorMessage } from '../auth/auth-errors'
import GeneratedPassword from './GeneratedPassword.vue'
import { usersApi, type AdminUser } from './users-api'

/** Define uma nova senha para o usuário (sem e-mail ainda, o admin repassa a senha). */
const props = defineProps<{ user: AdminUser | null }>()
const open = defineModel<boolean>('open', { default: false })
const { show } = useToast()

const password = ref('')
const revoke = ref(true)
const error = ref('')
const formError = ref('')
const submitting = ref(false)
const done = ref(false)

watch(open, (value) => {
  if (!value) return
  password.value = generatePassword()
  revoke.value = true
  error.value = ''
  formError.value = ''
  done.value = false
})

async function submit() {
  if (!props.user) return
  const parsed = setPasswordSchema.safeParse({ password: password.value })
  if (!parsed.success) {
    error.value = fieldErrors(parsed.error).password ?? ''
    return
  }
  submitting.value = true
  const res = await usersApi.setPassword(props.user.id, password.value)
  if (!res.error && revoke.value) await usersApi.revokeSessions(props.user.id)
  submitting.value = false
  if (res.error) {
    formError.value = authErrorMessage(res.error)
    return
  }
  done.value = true
  show('Senha redefinida.')
}
</script>

<template>
  <FwDialog
    v-model:open="open"
    size="sm"
    :title="done ? 'Senha redefinida' : 'Redefinir senha'"
    :description="user ? `${user.name} · ${user.email}` : ''"
  >
    <FormAlert v-if="formError">{{ formError }}</FormAlert>
    <GeneratedPassword v-model="password" label="Nova senha" :readonly="done" :error="error" />
    <FwCheckbox v-if="!done" v-model="revoke" label="Encerrar as sessões abertas dessa pessoa" />
    <template #footer>
      <template v-if="!done">
        <FwButton variant="ghost" @click="open = false">Cancelar</FwButton>
        <FwButton :disabled="submitting" icon-left="key" @click="submit">
          {{ submitting ? 'Salvando…' : 'Definir senha' }}
        </FwButton>
      </template>
      <FwButton v-else @click="open = false">Concluir</FwButton>
    </template>
  </FwDialog>
</template>
