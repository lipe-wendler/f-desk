<script setup lang="ts">
import { resolveComponent } from 'vue'
import FwLogo from './FwLogo.vue'

/** Link da barra. `match` estende o destaque às rotas abaixo dele (ex.: `/tecnico` cobre `/tecnico/chamados/TKT-0007`). */
export interface FwAppHeaderLink {
  label: string
  to: string
  match?: string
}

/**
 * Barra de navegação: logo, links e ações (slot `actions`). `brand` é o nome lido pelos leitores de tela.
 * O link ativo recebe `aria-current="page"`: na rota exata ou, com `match`, em qualquer rota abaixo do prefixo.
 */
withDefaults(
  defineProps<{
    brand?: string
    homeTo?: string
    links?: FwAppHeaderLink[]
  }>(),
  { brand: 'F.Desk', homeTo: '/', links: () => [] },
)
const link = resolveComponent('RouterLink')

function isCurrent(item: FwAppHeaderLink, path: string, exact: boolean) {
  if (exact) return true
  if (!item.match) return false
  const prefix = item.match.replace(/\/+$/, '')
  return path === prefix || path.startsWith(`${prefix}/`)
}
</script>

<template>
  <header class="fw-header">
    <component :is="link" class="fw-header-brand" :to="homeTo">
      <FwLogo :label="brand" />
    </component>
    <nav class="fw-nav" aria-label="Principal">
      <component
        :is="link"
        v-for="item in links"
        :key="item.to"
        v-slot="{ href, navigate, isExactActive }"
        :to="item.to"
        custom
      >
        <a
          :href="href"
          :aria-current="isCurrent(item, $route.path, isExactActive) ? 'page' : undefined"
          @click="navigate"
          >{{ item.label }}</a
        >
      </component>
    </nav>
    <div class="fw-header-actions"><slot name="actions" /></div>
  </header>
</template>
