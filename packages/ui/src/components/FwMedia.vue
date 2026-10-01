<script setup lang="ts">
/** Espaço para imagem gerada fora do código; sem `src` mostra um placeholder hachurado. */
withDefaults(
  defineProps<{ src?: string; alt?: string; ratio?: string; label?: string | false }>(),
  {
    label: 'Image',
  },
)
</script>

<template>
  <span
    v-if="src"
    class="fw-media"
    :style="ratio ? { aspectRatio: ratio, height: 'auto' } : undefined"
  >
    <img :src="src" :alt="alt ?? ''" loading="lazy" />
  </span>
  <span
    v-else
    class="fw-media fw-media-empty"
    :style="ratio ? { aspectRatio: ratio, height: 'auto' } : undefined"
    role="img"
    :aria-label="alt ?? 'Imagem pendente'"
  >
    <span v-if="label !== false">{{ label }}</span>
  </span>
</template>
