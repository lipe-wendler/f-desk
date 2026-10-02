<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'
import { useId } from 'vue'

/** Registro do chamado aberto pela conversa, sob a fala do Wen que o anuncia (vem gravado no servidor). */
defineProps<{ code: string; subject: string }>()
const titleId = useId()
</script>

<template>
  <section class="chat-proposal" :aria-labelledby="titleId" data-testid="ticket-created">
    <p :id="titleId" class="chat-proposal-done">
      <FwIcon name="check" size="sm" />Chamado {{ code }} aberto
    </p>
    <p class="m-0 text-sm font-semibold">{{ subject }}</p>
    <RouterLink :to="`/chamados/${code}`" class="chat-link self-start">Ver chamado</RouterLink>
  </section>
</template>
