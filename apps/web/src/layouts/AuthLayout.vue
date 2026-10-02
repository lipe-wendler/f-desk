<script setup lang="ts">
import ThemeToggle from '../components/ThemeToggle.vue'
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-8 px-4 py-6">
    <div class="flex items-center justify-between">
      <RouterLink to="/" class="fw-wordmark">F.Desk</RouterLink>
      <ThemeToggle />
    </div>
    <main class="flex flex-1 flex-col justify-center pb-16">
      <div class="rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
