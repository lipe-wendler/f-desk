<script setup lang="ts">
import { FwButton, FwSectionLabel } from '@f-desk/ui'
import { homeFor } from '../router/access'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
</script>

<template>
  <section
    class="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-8 shadow-card"
  >
    <FwSectionLabel bar>403</FwSectionLabel>
    <h1 class="m-0 font-display text-[32px] leading-10 font-semibold">
      Você não tem acesso a esta página
    </h1>
    <p class="m-0 text-ink-muted">Se precisar desse acesso, fale com o admin da plataforma.</p>
    <FwButton :to="homeFor(session.user?.role)" variant="secondary">Voltar ao início</FwButton>
  </section>
</template>
