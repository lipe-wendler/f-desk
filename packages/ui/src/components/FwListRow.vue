<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { resolveComponent } from 'vue'
import FwIcon from './FwIcon.vue'
import FwMedia from './FwMedia.vue'

/** Linha de lista clicável com miniatura (opcional), título e subtítulo. `to` usa o RouterLink. */
const props = defineProps<{
  title: string
  subtitle?: string
  image?: string
  imageAlt?: string
  thumb?: boolean
  href?: string
  to?: RouteLocationRaw
}>()
const tag = props.to ? resolveComponent('RouterLink') : 'a'
</script>

<template>
  <component :is="tag" class="fw-listrow" v-bind="to ? { to } : { href: href ?? '#' }">
    <span v-if="thumb || image" class="fw-listrow-thumb">
      <FwMedia :src="image" :alt="imageAlt" :label="false" />
    </span>
    <span class="fw-listrow-text">
      <span class="fw-listrow-title">{{ title }}</span>
      <span v-if="subtitle" class="fw-listrow-sub">{{ subtitle }}</span>
    </span>
    <slot name="meta" />
    <span class="fw-iconbtn fw-iconbtn-sm" aria-hidden="true">
      <FwIcon name="arrow-right" size="sm" />
    </span>
  </component>
</template>
