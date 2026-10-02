<script setup lang="ts">
import { FwIconButton } from '@f-desk/ui'
import { ref } from 'vue'

/**
 * Faixa de palavras em movimento contínuo. Tem botão de pausar (WCAG 2.2.2) e fica parada
 * para quem pede menos movimento no sistema. A cópia usada no loop é escondida dos leitores de tela.
 */
defineProps<{ words: string[] }>()
const paused = ref(false)
</script>

<template>
  <div class="landing-marquee" :class="{ 'is-paused': paused }">
    <div class="landing-marquee-viewport">
      <div class="landing-marquee-track">
        <ul class="landing-marquee-list">
          <li v-for="word in words" :key="word">{{ word }}</li>
        </ul>
        <ul class="landing-marquee-list" aria-hidden="true">
          <li v-for="word in words" :key="word">{{ word }}</li>
        </ul>
      </div>
    </div>
    <FwIconButton
      class="landing-marquee-toggle"
      :icon="paused ? 'play' : 'pause'"
      :label="paused ? 'Retomar animação das palavras' : 'Pausar animação das palavras'"
      :aria-pressed="paused ? 'true' : 'false'"
      size="sm"
      @click="paused = !paused"
    />
  </div>
</template>
