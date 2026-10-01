<script setup lang="ts">
import { FwButton, FwSectionLabel, FwTag, FwTextarea } from '@f-desk/ui'
import { ref } from 'vue'

/** Chatbot público: qualquer visitante tira dúvidas sem conta. Abrir chamado exige login. */
const draft = ref('')
const suggestions = [
  'Não consigo acessar meu e-mail',
  'Como redefinir minha senha?',
  'Meu computador está lento',
]
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
    <section
      class="flex min-h-[480px] flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8"
    >
      <div class="flex flex-col gap-3">
        <FwSectionLabel bar>Atendimento</FwSectionLabel>
        <h1
          class="m-0 font-display text-[32px] leading-10 font-semibold tracking-[-0.015em] sm:text-[48px] sm:leading-[56px] sm:font-bold"
        >
          Como posso <span class="fw-hl">ajudar?</span>
        </h1>
        <p class="m-0 max-w-[56ch] text-ink-muted">
          Wen, assistente de suporte da F.Wendler, responde às dúvidas mais comuns na hora. Se o
          caso precisar de um técnico, você abre um chamado e acompanha tudo por aqui.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <FwTag v-for="s in suggestions" :key="s" clickable @click="draft = s">{{ s }}</FwTag>
      </div>

      <div class="mt-auto flex flex-col gap-3">
        <FwTextarea
          v-model="draft"
          label="Sua mensagem"
          placeholder="Descreva o que está acontecendo…"
          :max-length="1000"
          disabled
          hint="O chat chega na tarefa feat/chatbot-faq-e-llm."
        />
        <div class="flex justify-end">
          <FwButton arrow disabled>Enviar</FwButton>
        </div>
      </div>
    </section>

    <aside class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-card">
      <FwSectionLabel>Precisa de um técnico?</FwSectionLabel>
      <p class="m-0 text-sm text-ink-muted">
        Para abrir um chamado e ver o histórico das suas conversas e chamados, entre na sua conta.
        Criar uma conta leva menos de um minuto.
      </p>
      <FwButton :to="{ name: 'ticket-new' }" icon-left="plus">Abrir chamado</FwButton>
      <FwButton :to="{ name: 'sign-up' }" variant="secondary">Criar conta</FwButton>
    </aside>
  </div>
</template>
