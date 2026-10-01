<script setup lang="ts">
import PagePlaceholder from '../../components/PagePlaceholder.vue'
</script>

<template>
  <PagePlaceholder
    eyebrow="Entrar"
    title="Entre na sua conta"
    description="Login por e-mail e senha para clientes, técnicos e admins. Depois do login, você volta para a página que pediu (ex.: abrir chamado)."
    task="feat/telas-de-login-e-cadastro"
  >
    <p class="m-0 text-sm text-ink-muted">
      Ainda não tem conta?
      <RouterLink class="text-accent-text" to="/criar-conta">Criar conta</RouterLink>
    </p>
  </PagePlaceholder>
</template>
