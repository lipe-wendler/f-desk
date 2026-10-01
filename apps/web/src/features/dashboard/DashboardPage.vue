<script setup lang="ts">
import { FwMetricCard } from '@f-desk/ui'
import PagePlaceholder from '../../components/PagePlaceholder.vue'
</script>

<template>
  <div class="flex flex-col gap-6">
    <PagePlaceholder
      eyebrow="Dashboard"
      title="Fila de chamados"
      description="Chamados abertos, em atendimento e aguardando cliente, com filtros, atribuição e mudança de status."
      task="feat/dashboard-do-tecnico"
    />
    <div class="grid gap-4 sm:grid-cols-3">
      <FwMetricCard value="—" label="Chamados abertos" icon="inbox" kicker="Fila" />
      <FwMetricCard value="—" label="Em atendimento" icon="clock" kicker="Agora" />
      <FwMetricCard value="—" label="Resolvidos na semana" icon="check" kicker="Semana" />
    </div>
  </div>
</template>
