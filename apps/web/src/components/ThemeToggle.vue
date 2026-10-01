<script setup lang="ts">
import { FwIconButton, useTheme } from '@f-desk/ui'

const { theme, toggleTheme } = useTheme()
</script>

<template>
  <FwIconButton
    :icon="theme === 'dark' ? 'sun' : 'moon'"
    :label="theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'"
    size="sm"
    @click="toggleTheme"
  />
</template>
