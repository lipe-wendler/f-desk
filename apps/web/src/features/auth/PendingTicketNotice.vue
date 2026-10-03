<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'

/** Faixa do cadastro e do login quando a pessoa veio do cartão do chamado preparado pela Wen. */
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-md border border-accent bg-accent-soft px-4 py-3 text-sm text-ink"
    data-testid="pending-ticket"
  >
    <FwIcon name="inbox" size="sm" class="mt-0.5 flex-none text-accent-text" />
    <p class="m-0">
      <strong class="font-semibold">Falta pouco para abrir seu chamado.</strong>
      Em seguida você volta para a conversa com a Wen e confirma o chamado.
    </p>
  </div>
</template>
