<script setup lang="ts">
import { resolveComponent } from 'vue'

/**
 * Barra de navegação: wordmark, links e ações (slot `actions`).
 * Links com `to` usam o RouterLink, que marca `aria-current="page"` na rota ativa.
 */
withDefaults(
  defineProps<{
    brand?: string
    homeTo?: string
    links?: { label: string; to: string }[]
  }>(),
  { brand: 'F.Desk', homeTo: '/', links: () => [] },
)
const link = resolveComponent('RouterLink')
</script>

<template>
  <header class="fw-header">
    <component :is="link" class="fw-wordmark" :to="homeTo">{{ brand }}</component>
    <nav class="fw-nav" aria-label="Principal">
      <component :is="link" v-for="item in links" :key="item.to" :to="item.to">{{
        item.label
      }}</component>
    </nav>
    <div class="fw-header-actions"><slot name="actions" /></div>
  </header>
</template>
