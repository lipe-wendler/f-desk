<script setup lang="ts">
import { formatMessageTime } from '../../../lib/format'
import type { ChatEntry } from '../../../stores/chat'
import TypingDots from './TypingDots.vue'

/**
 * Uma fala da conversa. Cliente: amarelo, à direita. Wen: cinza, à esquerda, com o avatar.
 * O nome de quem fala vai em texto para leitores de tela (o avatar é decorativo). Embaixo, o horário.
 */
defineProps<{ entry: ChatEntry }>()
</script>

<template>
  <div :class="['chat-row', entry.role === 'user' ? 'chat-row-user' : 'chat-row-bot']">
    <img
      v-if="entry.role === 'assistant'"
      src="/brand/wen-96.webp"
      alt=""
      width="32"
      height="32"
      class="chat-avatar"
    />
    <div
      class="flex min-w-0 flex-col gap-1"
      :class="entry.role === 'user' ? 'items-end' : 'items-start'"
    >
      <p
        :class="[
          'chat-bubble',
          entry.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot',
          entry.failed && 'chat-bubble-failed',
        ]"
      >
        <span class="sr-only">{{ entry.role === 'user' ? 'Você:' : 'Wen:' }}</span>
        <TypingDots v-if="entry.pending && !entry.content" />
        <template v-else>{{ entry.content }}</template>
      </p>
      <time
        v-if="entry.createdAt && !entry.pending"
        :datetime="entry.createdAt"
        class="font-mono text-[11px] text-ink-muted"
        >{{ formatMessageTime(entry.createdAt) }}</time
      >
      <slot />
    </div>
  </div>
</template>
