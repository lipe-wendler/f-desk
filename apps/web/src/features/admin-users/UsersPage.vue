<script setup lang="ts">
import { ROLE_LABEL, type Role } from '@f-desk/shared'
import { FwButton, FwIcon, FwInput, FwSectionLabel, FwTabs, FwTag } from '@f-desk/ui'
import { computed, onMounted, ref, watch } from 'vue'
import FormAlert from '../../components/FormAlert.vue'
import { useToast } from '../../composables/useToast'
import { initialsOf } from '../../lib/initials'
import { useSessionStore } from '../../stores/session'
import { authErrorMessage } from '../auth/auth-errors'
import BanUserDialog from './BanUserDialog.vue'
import ChangeRoleDialog from './ChangeRoleDialog.vue'
import CreateUserDialog from './CreateUserDialog.vue'
import ResetPasswordDialog from './ResetPasswordDialog.vue'
import UserRowActions, { type UserAction } from './UserRowActions.vue'
import { usersApi, type AdminUser } from './users-api'

/** Gestão de usuários (só admin): lista, cria contas da equipe, troca perfil, senha e acesso. */
const PAGE_SIZE = 20
const session = useSessionStore()
const { show } = useToast()

const filter = ref<Role | 'all'>('all')
const search = ref('')
const page = ref(1)
const users = ref<AdminUser[]>([])
const total = ref(0)
const loading = ref(true)
const loadError = ref('')

const selected = ref<AdminUser | null>(null)
const dialogs = ref({ create: false, role: false, password: false, ban: false })

const tabs = [
  { value: 'all', label: 'Todos' },
  { value: 'client', label: 'Clientes' },
  { value: 'technician', label: 'Técnicos' },
  { value: 'admin', label: 'Admins' },
]
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const range = computed(() => {
  if (!total.value) return ''
  const start = (page.value - 1) * PAGE_SIZE + 1
  return `${start}–${Math.min(start + users.value.length - 1, total.value)} de ${total.value}`
})
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

let requestId = 0
async function load() {
  const id = ++requestId
  loading.value = true
  loadError.value = ''
  const { data, error } = await usersApi.list({
    search: search.value,
    role: filter.value,
    page: page.value,
    pageSize: PAGE_SIZE,
  })
  if (id !== requestId) return
  loading.value = false
  if (error) {
    loadError.value = authErrorMessage(error)
    return
  }
  users.value = data.users
  total.value = data.total
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})
watch(filter, () => {
  page.value = 1
  load()
})
watch(page, load)
onMounted(load)

async function onAction(user: AdminUser, action: UserAction) {
  selected.value = user
  if (action === 'role') dialogs.value.role = true
  else if (action === 'password') dialogs.value.password = true
  else if (action === 'ban') dialogs.value.ban = true
  else if (action === 'unban') {
    const { error } = await usersApi.unban(user.id)
    if (error) show(authErrorMessage(error), 'danger')
    else {
      show(`Acesso de ${user.name} reativado.`)
      load()
    }
  } else if (action === 'sessions') {
    const { error } = await usersApi.revokeSessions(user.id)
    show(
      error ? authErrorMessage(error) : `Sessões de ${user.name} encerradas.`,
      error ? 'danger' : 'success',
    )
  }
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-2">
        <FwSectionLabel bar>Gestão de usuários</FwSectionLabel>
        <h1 class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em]">
          Usuários
        </h1>
        <p class="m-0 max-w-[60ch] text-ink-muted">
          Crie contas da equipe, ajuste perfis e controle o acesso. Clientes criam a própria conta.
        </p>
      </div>
      <FwButton icon-left="plus" @click="dialogs.create = true">Novo usuário</FwButton>
    </header>

    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <FwTabs
        v-model="filter"
        :items="tabs"
        label="Filtrar por perfil"
        class="max-w-full overflow-x-auto"
      />
      <div class="md:w-96">
        <FwInput
          v-model="search"
          type="search"
          icon="search"
          placeholder="Buscar por nome ou e-mail"
        />
      </div>
    </div>

    <FormAlert v-if="loadError">{{ loadError }}</FormAlert>

    <div class="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <div
        class="hidden grid-cols-[minmax(0,2fr)_120px_120px_110px_44px] gap-4 border-b border-line px-5 py-3 font-mono text-[11px] tracking-[0.16em] text-ink-muted uppercase md:grid"
        aria-hidden="true"
      >
        <span>Usuário</span><span>Perfil</span><span>Status</span><span>Criado em</span><span />
      </div>

      <ul v-if="users.length" class="m-0 list-none p-0" :aria-busy="loading ? 'true' : 'false'">
        <li
          v-for="user in users"
          :key="user.id"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,2fr)_120px_120px_110px_44px]"
        >
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="grid size-9 flex-none place-items-center rounded-pill bg-surface-raised font-mono text-xs font-bold text-ink"
              aria-hidden="true"
              >{{ initialsOf(user.name) }}</span
            >
            <div class="flex min-w-0 flex-col">
              <span class="flex items-center gap-2 truncate font-semibold">
                {{ user.name }}
                <FwTag v-if="user.id === session.user?.id" size="sm" system>Você</FwTag>
              </span>
              <span class="truncate text-sm text-ink-muted">{{ user.email }}</span>
            </div>
          </div>
          <div class="col-start-2 row-start-1 md:hidden">
            <UserRowActions
              v-if="user.id !== session.user?.id"
              :user="user"
              @action="onAction(user, $event)"
            />
          </div>
          <div class="col-span-2 flex flex-wrap items-center gap-2 md:contents">
            <span
              ><FwTag size="sm" system :selected="user.role === 'admin'">{{
                ROLE_LABEL[user.role]
              }}</FwTag></span
            >
            <span
              :class="[
                'inline-flex items-center gap-1 text-sm',
                user.banned ? 'text-danger' : 'text-success',
              ]"
              :title="user.banned && user.banReason ? `Motivo: ${user.banReason}` : undefined"
            >
              <FwIcon :name="user.banned ? 'alert' : 'check'" size="sm" />{{
                user.banned ? 'Desativado' : 'Ativo'
              }}
            </span>
            <span class="font-mono text-xs text-ink-muted">{{
              dateFormat.format(new Date(user.createdAt))
            }}</span>
          </div>
          <div class="hidden md:block">
            <UserRowActions
              v-if="user.id !== session.user?.id"
              :user="user"
              @action="onAction(user, $event)"
            />
          </div>
        </li>
      </ul>

      <p v-else-if="loading" class="m-0 px-5 py-10 text-center text-ink-muted">
        Carregando usuários…
      </p>
      <p v-else class="m-0 px-5 py-10 text-center text-ink-muted">
        {{
          search
            ? 'Nenhum usuário encontrado para essa busca.'
            : 'Nenhum usuário nesse perfil ainda.'
        }}
      </p>
    </div>

    <nav
      v-if="pages > 1 || range"
      class="flex items-center justify-between gap-4"
      aria-label="Paginação"
    >
      <span class="font-mono text-xs text-ink-muted">{{ range }}</span>
      <div v-if="pages > 1" class="flex gap-2">
        <FwButton variant="secondary" size="sm" :disabled="page <= 1" @click="page--"
          >Anterior</FwButton
        >
        <FwButton variant="secondary" size="sm" :disabled="page >= pages" @click="page++"
          >Próxima</FwButton
        >
      </div>
    </nav>

    <CreateUserDialog v-model:open="dialogs.create" @created="load" />
    <ChangeRoleDialog v-model:open="dialogs.role" :user="selected" @changed="load" />
    <ResetPasswordDialog v-model:open="dialogs.password" :user="selected" />
    <BanUserDialog v-model:open="dialogs.ban" :user="selected" @changed="load" />
  </section>
</template>
