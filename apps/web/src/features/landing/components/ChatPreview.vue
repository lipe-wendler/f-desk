<script setup lang="ts">
import { FwIcon } from '@f-desk/ui'

/**
 * Mock estático de uma conversa com o Wen, usado no hero. É ilustração: fica escondido dos
 * leitores de tela, e `label` descreve a cena em texto.
 */
defineProps<{ label: string }>()
</script>

<template>
  <figure class="landing-preview m-0">
    <div class="landing-preview-window" aria-hidden="true">
      <div class="landing-preview-bar">
        <img src="/brand/wen-96.webp" alt="" width="32" height="32" class="rounded-sm" />
        <div class="flex flex-col">
          <span class="text-sm font-semibold text-ink">Wen</span>
          <span class="flex items-center gap-1 font-mono text-[11px] text-ink-muted">
            <span class="size-2 rounded-pill bg-success" />disponível
          </span>
        </div>
      </div>
      <div class="flex flex-col gap-3 p-4">
        <p class="landing-bubble landing-bubble-user">Não consigo acessar o sistema desde ontem.</p>
        <div class="flex items-end gap-2">
          <img src="/brand/wen-96.webp" alt="" width="28" height="28" class="rounded-sm" />
          <p class="landing-bubble landing-bubble-bot">
            Vamos resolver. Você já tentou redefinir a senha pela tela de login?
          </p>
        </div>
        <p class="landing-bubble landing-bubble-user">Já tentei e não funcionou.</p>
        <div class="flex items-end gap-2">
          <img src="/brand/wen-96.webp" alt="" width="28" height="28" class="rounded-sm" />
          <div class="landing-ticket">
            <span
              class="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-ink-muted uppercase"
            >
              <FwIcon name="check" size="sm" class="text-success" />Chamado aberto
            </span>
            <span class="font-semibold text-ink"
              >TKT-0042 · Acesso bloqueado após troca de senha</span
            >
            <span class="text-sm text-ink-muted">Um técnico já recebeu a conversa.</span>
          </div>
        </div>
      </div>
    </div>
    <figcaption class="sr-only">{{ label }}</figcaption>
  </figure>
</template>
