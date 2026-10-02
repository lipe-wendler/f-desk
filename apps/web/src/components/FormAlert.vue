<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'

/** Erro geral de um formulário (credenciais inválidas, falha de rede…). */
</script>

<template>
  <div
    role="alert"
    class="flex items-start gap-2 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
  >
    <FwIcon name="alert" size="sm" class="mt-0.5" />
    <span><slot /></span>
  </div>
</template>
