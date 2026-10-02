<script setup lang="ts">
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from '@f-desk/shared'
import { FwButton, FwDialog, FwRadio } from '@f-desk/ui'
import { ref, watch } from 'vue'
import FormAlert from '../../components/FormAlert.vue'
import { useToast } from '../../composables/useToast'
import { authErrorMessage } from '../auth/auth-errors'
import { usersApi, type AdminUser } from './users-api'

const props = defineProps<{ user: AdminUser | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [] }>()
const { show } = useToast()

const role = ref<Role>('client')
const formError = ref('')
const submitting = ref(false)

watch(open, (value) => {
  if (value && props.user) {
    role.value = props.user.role
    formError.value = ''
  }
})

async function submit() {
  if (!props.user || role.value === props.user.role) {
    open.value = false
    return
  }
  submitting.value = true
  const { error } = await usersApi.setRole(props.user.id, role.value)
  submitting.value = false
  if (error) {
    formError.value = authErrorMessage(error)
    return
  }
  show(`${props.user.name} agora é ${ROLE_LABEL[role.value]}.`)
  open.value = false
  emit('changed')
}
</script>

<template>
  <FwDialog
    v-model:open="open"
    size="sm"
    title="Alterar perfil"
    :description="user ? `${user.name} · ${user.email}` : ''"
  >
    <FormAlert v-if="formError">{{ formError }}</FormAlert>
    <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
      <legend class="sr-only">Perfil</legend>
      <div v-for="option in ASSIGNABLE_ROLES" :key="option" class="flex flex-col">
        <FwRadio v-model="role" name="change-role" :value="option" :label="ROLE_LABEL[option]" />
        <span class="pl-8 text-xs text-ink-muted">{{ ROLE_DESCRIPTION[option] }}</span>
      </div>
    </fieldset>
    <template #footer>
      <FwButton variant="ghost" @click="open = false">Cancelar</FwButton>
      <FwButton :disabled="submitting || role === user?.role" @click="submit">
        {{ submitting ? 'Salvando…' : 'Salvar perfil' }}
      </FwButton>
    </template>
  </FwDialog>
</template>
