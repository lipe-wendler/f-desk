<script setup lang="ts">
import PagePlaceholder from '../../components/PagePlaceholder.vue'
</script>

<template>
  <PagePlaceholder
    eyebrow="Criar conta"
    title="Crie sua conta de cliente"
    description="Cadastro por e-mail e senha. Toda conta criada aqui é de cliente; contas de técnico são criadas pelo admin."
    task="feat/telas-de-login-e-cadastro"
  >
    <p class="m-0 text-sm text-ink-muted">
      Já tem conta? <RouterLink class="text-accent-text" to="/entrar">Entrar</RouterLink>
    </p>
  </PagePlaceholder>
</template>
