<script setup lang="ts">
import { FwButton } from '@f-desk/ui'
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { useConversationsStore } from '../../../stores/conversations'
import KindBadge from './KindBadge.vue'
import { formatSince } from './recency'

/**
 * Conversas salvas do cliente, da mais recente para a mais antiga: título dado pelo bot, última
 * mensagem, tempo desde a última interação e o tipo. Scroll próprio e carga por página.
 */
const props = defineProps<{ activeId?: string }>()
const conversations = useConversationsStore()

const sentinel = useTemplateRef<HTMLElement>('sentinel')
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (!conversations.loaded && !conversations.loading) void conversations.load()
  // Carrega a próxima página quando o fim da lista aparece (o botão "Carregar mais" cobre o teclado).
  if (typeof IntersectionObserver === 'undefined' || !sentinel.value) return
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) void conversations.loadMore()
  })
  observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())

const isActive = (id: string) => id === props.activeId
</script>

<template>
  <div class="flex min-h-0 flex-col overflow-y-auto pr-1" :aria-busy="conversations.loading">
    <p
      v-if="conversations.error && !conversations.items.length"
      class="m-0 flex flex-col items-start gap-2 text-sm text-ink-muted"
      role="alert"
    >
      {{ conversations.error }}
      <FwButton variant="secondary" size="sm" @click="conversations.load()"
        >Tentar de novo</FwButton
      >
    </p>

    <ul
      v-else-if="!conversations.loaded"
      class="m-0 flex list-none flex-col gap-2 p-0"
      aria-label="Carregando conversas"
    >
      <li v-for="n in 5" :key="n" class="h-11 animate-pulse rounded-md bg-surface-raised" />
    </ul>

    <div v-else-if="!conversations.items.length" class="flex flex-col gap-1 py-6 text-center">
      <template v-if="conversations.query">
        <p class="m-0 font-semibold text-ink">Nenhuma conversa encontrada</p>
        <p class="m-0 text-sm text-ink-muted">Nada com “{{ conversations.query }}”.</p>
      </template>
      <template v-else>
        <p class="m-0 font-semibold text-ink">Nenhuma conversa ainda</p>
        <p class="m-0 text-sm text-ink-muted">Suas conversas com o Wen aparecem aqui.</p>
      </template>
    </div>

    <template v-else>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li v-for="item in conversations.items" :key="item.id">
          <RouterLink
            :to="{ name: 'chat', params: { conversa: item.id } }"
            :aria-current="isActive(item.id) ? 'page' : undefined"
            class="sidebar-item"
          >
            <span class="flex items-baseline gap-2">
              <span class="min-w-0 flex-1 truncate font-semibold">
                {{ item.title || item.firstQuestion || 'Conversa sem título' }}
              </span>
              <time
                :datetime="item.updatedAt"
                class="flex-none font-mono text-[11px] text-ink-muted"
              >
                {{ formatSince(item.updatedAt) }}
              </time>
            </span>
            <span class="flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-sm text-ink-muted">
                {{ item.lastMessage }}
              </span>
              <KindBadge v-if="item.kind" :kind="item.kind" />
            </span>
          </RouterLink>
        </li>
      </ul>
      <div ref="sentinel" aria-hidden="true" class="h-px" />
      <FwButton
        v-if="conversations.hasMore"
        variant="ghost"
        size="sm"
        class="self-center"
        :disabled="conversations.loading"
        @click="conversations.loadMore()"
      >
        {{ conversations.loading ? 'Carregando…' : 'Carregar mais' }}
      </FwButton>
    </template>
  </div>
</template>
