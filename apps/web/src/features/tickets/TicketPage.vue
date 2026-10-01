<script setup lang="ts">
import { useRoute } from 'vue-router'
import PagePlaceholder from '../../components/PagePlaceholder.vue'

const route = useRoute()
</script>

<template>
  <PagePlaceholder
    eyebrow="Chamado"
    :title="`Chamado ${route.params.id}`"
    description="Detalhe do chamado: status, mensagens trocadas com o técnico e a conversa original com o chatbot."
    task="feat/abertura-de-chamado-e-historico"
  />
</template>
