<script setup lang="ts">
import {
  createStaffUserSchema,
  fieldErrors,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  STAFF_CREATABLE_ROLES,
} from '@f-desk/shared'
import { FwButton, FwDialog, FwInput, FwRadio } from '@f-desk/ui'
import { reactive, ref, watch } from 'vue'
import FormAlert from '../../components/FormAlert.vue'
import { useFieldErrors } from '../../composables/useFieldErrors'
import { generatePassword } from '../../lib/password'
import { authErrorMessage } from '../auth/auth-errors'
import GeneratedPassword from './GeneratedPassword.vue'
import { usersApi } from './users-api'

/** Cria conta de técnico (ou admin). A senha inicial é gerada e mostrada uma única vez. */
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()

const form = reactive({
  name: '',
  email: '',
  role: 'technician' as (typeof STAFF_CREATABLE_ROLES)[number],
  password: '',
})
const errors = useFieldErrors(form)
const formError = ref('')
const submitting = ref(false)
const done = ref(false)

function reset() {
  Object.assign(form, { name: '', email: '', role: 'technician', password: generatePassword() })
  errors.value = {}
  formError.value = ''
  done.value = false
}
watch(open, (value) => value && reset(), { immediate: true })

async function submit() {
  formError.value = ''
  const parsed = createStaffUserSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }
  errors.value = {}
  submitting.value = true
  const { error } = await usersApi.create(parsed.data)
  submitting.value = false
  if (error) {
    formError.value = authErrorMessage(error)
    return
  }
  done.value = true
  emit('created')
}
</script>

<template>
  <FwDialog
    v-model:open="open"
    :title="done ? 'Conta criada' : 'Novo usuário da equipe'"
    :description="
      done
        ? `${form.name} já pode entrar com o e-mail e a senha abaixo.`
        : 'Clientes criam a própria conta. Aqui você cria contas de técnico ou de admin.'
    "
  >
    <form
      v-if="!done"
      id="create-user-form"
      class="flex flex-col gap-4"
      novalidate
      @submit.prevent="submit"
    >
      <FormAlert v-if="formError">{{ formError }}</FormAlert>
      <FwInput
        v-model="form.name"
        label="Nome"
        icon="user"
        placeholder="Nome completo"
        :error="errors.name"
      />
      <FwInput
        v-model="form.email"
        label="E-mail"
        type="email"
        icon="mail"
        placeholder="nome@fwendler.com"
        :error="errors.email"
      />
      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend class="mb-2 text-[13px] font-medium">Perfil</legend>
        <div v-for="role in STAFF_CREATABLE_ROLES" :key="role" class="flex flex-col">
          <FwRadio v-model="form.role" name="create-role" :value="role" :label="ROLE_LABEL[role]" />
          <span class="pl-8 text-xs text-ink-muted">{{ ROLE_DESCRIPTION[role] }}</span>
        </div>
      </fieldset>
      <GeneratedPassword v-model="form.password" :error="errors.password" />
    </form>

    <div v-else class="flex flex-col gap-4">
      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt class="text-ink-muted">E-mail</dt>
        <dd class="m-0 font-mono">{{ form.email.trim().toLowerCase() }}</dd>
        <dt class="text-ink-muted">Perfil</dt>
        <dd class="m-0">{{ ROLE_LABEL[form.role] }}</dd>
      </dl>
      <GeneratedPassword v-model="form.password" readonly />
    </div>

    <template #footer>
      <template v-if="!done">
        <FwButton variant="ghost" @click="open = false">Cancelar</FwButton>
        <FwButton type="submit" form="create-user-form" :disabled="submitting" icon-left="plus">
          {{ submitting ? 'Criando…' : 'Criar conta' }}
        </FwButton>
      </template>
      <FwButton v-else @click="open = false">Concluir</FwButton>
    </template>
  </FwDialog>
</template>
