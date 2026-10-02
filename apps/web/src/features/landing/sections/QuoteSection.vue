<script setup lang="ts">
import { landing } from '../landing-content'

const { quote } = landing
</script>

<template>
  <section class="landing-section" aria-label="Citação">
    <figure class="landing-quote fw-card m-0">
      <span class="fw-quote-mark" aria-hidden="true">“</span>
      <blockquote class="m-0">
        <p class="fw-quote-text">{{ quote.text }}</p>
      </blockquote>
      <figcaption class="fw-quote-by">{{ quote.by }}</figcaption>
    </figure>
  </section>
</template>
