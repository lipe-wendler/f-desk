<script setup lang="ts">
import { FwButton } from '@f-desk/ui'
import PagePlaceholder from '../../components/PagePlaceholder.vue'
</script>

<template>
  <PagePlaceholder
    eyebrow="Meus chamados"
    title="Seus chamados"
    description="Lista dos chamados que você abriu, com status, prioridade e a última atualização do técnico."
    task="feat/abertura-de-chamado-e-historico"
  >
    <div>
      <FwButton :to="{ name: 'ticket-new' }" icon-left="plus" size="sm">Abrir chamado</FwButton>
    </div>
  </PagePlaceholder>
</template>
