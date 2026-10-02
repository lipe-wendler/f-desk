<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { computed, resolveComponent } from 'vue'
import FwIcon from './FwIcon.vue'
import type { IconName } from './icons'

/**
 * Botão pílula. Um `primary` por bloco.
 * Com `href` vira `<a>`; com `to` vira `RouterLink` (precisa do vue-router instalado no app).
 */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    arrow?: boolean
    icon?: IconName
    iconLeft?: IconName
    href?: string
    to?: RouteLocationRaw
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)

const routerLink = props.to ? resolveComponent('RouterLink') : null
const tag = computed(() => (props.to ? routerLink! : props.href ? 'a' : 'button'))
const attrs = computed(() =>
  props.to ? { to: props.to } : props.href ? { href: props.href } : { type: props.type },
)
</script>

<template>
  <component
    :is="tag"
    v-bind="attrs"
    :class="['fw-btn', `fw-btn-${variant}`, size !== 'md' && `fw-btn-${size}`]"
  >
    <FwIcon v-if="iconLeft" :name="iconLeft" />
    <slot />
    <FwIcon v-if="arrow" name="arrow-right" class="fw-btn-arrow" />
    <FwIcon v-else-if="icon" :name="icon" />
  </component>
</template>
