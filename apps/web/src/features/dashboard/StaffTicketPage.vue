<script setup lang="ts">
import { useRoute } from 'vue-router'
import PagePlaceholder from '../../components/PagePlaceholder.vue'

const route = useRoute()
</script>

<template>
  <PagePlaceholder
    eyebrow="Chamado"
    :title="`Chamado ${route.params.id}`"
    description="Atendimento do chamado: conversa com o cliente, transcrição do chatbot, responsável, prioridade e status."
    task="feat/dashboard-do-tecnico"
  />
</template>
