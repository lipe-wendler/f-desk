<script setup lang="ts">
import { FwButton, FwDialog, FwTextarea } from '@f-desk/ui'
import { ref, watch } from 'vue'
import FormAlert from '../../components/FormAlert.vue'
import { useToast } from '../../composables/useToast'
import { authErrorMessage } from '../auth/auth-errors'
import { usersApi, type AdminUser } from './users-api'

/** Desativa o acesso (ban do better-auth): encerra as sessões e bloqueia novos logins. */
const props = defineProps<{ user: AdminUser | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [] }>()
const { show } = useToast()

const reason = ref('')
const formError = ref('')
const submitting = ref(false)

watch(open, (value) => {
  if (value) {
    reason.value = ''
    formError.value = ''
  }
})

async function submit() {
  if (!props.user) return
  submitting.value = true
  const { error } = await usersApi.ban(props.user.id, reason.value.trim())
  submitting.value = false
  if (error) {
    formError.value = authErrorMessage(error)
    return
  }
  show(`Acesso de ${props.user.name} desativado.`)
  open.value = false
  emit('changed')
}
</script>

<template>
  <FwDialog
    v-model:open="open"
    size="sm"
    title="Desativar acesso"
    :description="
      user
        ? `${user.name} sai de todas as sessões e não consegue mais entrar. O histórico de chamados é mantido e você pode reativar depois.`
        : ''
    "
  >
    <FormAlert v-if="formError">{{ formError }}</FormAlert>
    <FwTextarea
      v-model="reason"
      label="Motivo (opcional)"
      placeholder="Ex.: saiu da equipe"
      :max-length="200"
    />
    <template #footer>
      <FwButton variant="ghost" @click="open = false">Cancelar</FwButton>
      <FwButton variant="danger" :disabled="submitting" @click="submit">
        {{ submitting ? 'Desativando…' : 'Desativar acesso' }}
      </FwButton>
    </template>
  </FwDialog>
</template>
