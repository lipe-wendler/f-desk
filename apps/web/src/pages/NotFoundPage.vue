<script setup lang="ts">
import { FwButton, FwSectionLabel } from '@f-desk/ui'
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center gap-4 px-4">
    <FwSectionLabel bar>404</FwSectionLabel>
    <h1 class="m-0 font-display text-[48px] leading-[56px] font-bold tracking-[-0.02em]">
      Página não <span class="fw-hl">encontrada.</span>
    </h1>
    <p class="m-0 text-ink-muted">O endereço pode ter mudado ou nunca ter existido.</p>
    <div><FwButton to="/" arrow>Ir para o atendimento</FwButton></div>
  </div>
</template>
