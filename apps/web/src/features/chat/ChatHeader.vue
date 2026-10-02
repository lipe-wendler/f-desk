<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'
import { computed, inject, useTemplateRef } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import { CONVERSATIONS_DRAWER } from './shell'
import { useAssistantStatus } from './useAssistantStatus'

/**
 * Barra do topo do atendimento: menu de conversas (celular), onde a pessoa está, o status do Wen,
 * o tema e a ajuda. Única barra da página, no desktop e no celular.
 */
const props = defineProps<{ current: string }>()
const emit = defineEmits<{ home: [] }>()

const drawer = inject(CONVERSATIONS_DRAWER, null)
const menuButton = useTemplateRef<HTMLButtonElement>('menuButton')
const { llm } = useAssistantStatus()

const status = computed(() =>
  llm.value === null
    ? null
    : llm.value
      ? { label: 'Wen disponível', dot: 'bg-success' }
      : { label: 'Só respostas prontas', dot: 'bg-ink-muted' },
)
const isHome = computed(() => props.current === 'Início')
</script>

<template>
  <header class="chat-header">
    <button
      v-if="drawer"
      ref="menuButton"
      type="button"
      class="chat-header-btn chat-header-menu"
      aria-label="Abrir conversas"
      aria-controls="drawer-de-conversas"
      aria-expanded="false"
      @click="drawer.open(menuButton)"
    >
      <FwIcon name="menu" />
    </button>

    <nav aria-label="Você está em" class="min-w-0 flex-1">
      <ol class="m-0 flex min-w-0 list-none items-center gap-2 p-0 text-sm">
        <li class="flex-none max-sm:hidden">
          <button v-if="!isHome" type="button" class="chat-crumb" @click="emit('home')">
            Atendimento
          </button>
          <span v-else class="text-ink-muted">Atendimento</span>
        </li>
        <li class="flex-none text-ink-muted max-sm:hidden" aria-hidden="true">/</li>
        <li class="min-w-0 truncate font-semibold text-ink" aria-current="page">{{ current }}</li>
      </ol>
    </nav>

    <span v-if="status" class="chat-status" role="status">
      <span class="size-2 flex-none rounded-pill" :class="status.dot" aria-hidden="true" />
      <span class="max-sm:sr-only">{{ status.label }}</span>
    </span>
    <span class="h-6 w-px bg-line max-sm:hidden" aria-hidden="true" />
    <ThemeToggle />
    <RouterLink
      :to="{ path: '/', hash: '#duvidas' }"
      class="chat-header-btn"
      aria-label="Ajuda"
      title="Ajuda"
    >
      <FwIcon name="help" />
    </RouterLink>
  </header>
</template>
