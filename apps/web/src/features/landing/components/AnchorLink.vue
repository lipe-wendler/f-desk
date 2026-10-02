<script setup lang="ts">
/**
 * Link para uma seção da página (`#id`). Navega pelo router (o scroll desconta o topo fixo),
 * mas sem `aria-current`: o RouterLink comum ignora o hash e marcaria todos como página atual.
 */
defineProps<{ target: string }>()
defineEmits<{ navigate: [] }>()
</script>

<template>
  <RouterLink v-slot="{ href, navigate }" :to="{ hash: `#${target}` }" custom>
    <a
      :href="href"
      @click="
        (event: MouseEvent) => {
          navigate(event)
          $emit('navigate')
        }
      "
      ><slot
    /></a>
  </RouterLink>
</template>
