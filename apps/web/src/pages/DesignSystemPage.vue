<script setup lang="ts">
import {
  FwButton,
  FwCheckbox,
  FwFeatureCard,
  FwIcon,
  FwIconButton,
  FwInput,
  FwListRow,
  FwLogo,
  FwMedia,
  FwMetricCard,
  FwRadio,
  FwSectionLabel,
  FwSelect,
  FwStepper,
  FwSwitch,
  FwTabs,
  FwTag,
  FwTextarea,
  ICON_NAMES,
} from '@f-desk/ui'
import { ref } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

/** Vitrine do design system (só em dev): todos os componentes nos dois temas. */
const email = ref('')
const priority = ref('')
const description = ref('')
const notify = ref(true)
const urgent = ref(false)
const channel = ref('chat')
const tab = ref('open')

const swatches = [
  'bg',
  'surface',
  'surface-raised',
  'field',
  'line',
  'line-strong',
  'ink',
  'ink-muted',
  'accent',
  'accent-text',
  'accent-soft',
  'success',
  'danger',
]
</script>

<template>
  <div class="mx-auto flex max-w-content flex-col gap-12 px-4 py-8 sm:px-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-3">
        <FwSectionLabel bar>F.Wendler · design system</FwSectionLabel>
        <h1 class="m-0 font-display text-[48px] leading-[56px] font-bold tracking-[-0.02em]">
          Component <span class="fw-hl">System</span>
        </h1>
        <p class="m-0 max-w-[60ch] text-lg text-ink-muted">
          Tokens, tipografia e componentes Vue do F.Desk. Dark com os neutros quentes da Anthropic;
          o amarelo é o único acento.
        </p>
      </div>
      <ThemeToggle />
    </header>

    <section class="flex flex-col gap-4">
      <FwSectionLabel :number="1">Cor</FwSectionLabel>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div v-for="s in swatches" :key="s" class="flex flex-col gap-2">
          <div class="h-16 rounded-md border border-line" :style="{ background: `var(--${s})` }" />
          <code class="font-mono text-xs text-ink-muted">{{ s }}</code>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <FwSectionLabel :number="2">Tipografia</FwSectionLabel>
      <p class="m-0 font-display text-[64px] leading-[72px] font-bold tracking-[-0.025em]">
        From insight to <span class="fw-hl">impact.</span>
      </p>
      <p class="m-0 font-display text-[32px] leading-10 font-semibold">
        Urbanist — títulos e voz da marca
      </p>
      <p class="m-0 text-lg">DM Sans — interface, texto corrido, botões e formulários.</p>
      <p class="m-0 font-mono text-xs tracking-[0.16em] uppercase text-ink-muted">
        Space Mono — rótulos técnicos · 01.10.2026 · v0.1
      </p>
    </section>

    <section class="flex flex-col gap-4">
      <FwSectionLabel :number="3">Ações</FwSectionLabel>
      <div class="fw-row">
        <FwButton arrow>Abrir chamado</FwButton>
        <FwButton variant="secondary">Ver histórico</FwButton>
        <FwButton variant="outline" icon-left="message">Falar com a Wen</FwButton>
        <FwButton variant="ghost">Cancelar</FwButton>
        <FwButton size="sm">Pequeno</FwButton>
        <FwButton size="lg" arrow>Grande</FwButton>
        <FwButton disabled>Desabilitado</FwButton>
      </div>
      <div class="fw-row">
        <FwIconButton icon="search" label="Buscar" />
        <FwIconButton icon="plus" label="Novo" tone="accent" />
        <FwIconButton icon="settings" label="Configurações" size="sm" />
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <FwSectionLabel :number="4">Formulários</FwSectionLabel>
      <div class="grid gap-4 md:grid-cols-2">
        <FwInput
          v-model="email"
          label="E-mail"
          icon="mail"
          placeholder="voce@empresa.com"
          hint="Usado para login e avisos do chamado."
        />
        <FwInput label="Senha" type="password" error="A senha precisa ter 8 caracteres ou mais." />
        <FwSelect
          v-model="priority"
          label="Prioridade"
          placeholder="Escolha a prioridade"
          :options="[
            { value: 'low', label: 'Baixa' },
            { value: 'medium', label: 'Média' },
            { value: 'high', label: 'Alta' },
            { value: 'urgent', label: 'Urgente' },
          ]"
        />
        <FwTextarea
          v-model="description"
          label="Descrição"
          placeholder="O que aconteceu?"
          :max-length="500"
        />
      </div>
      <div class="fw-row">
        <FwCheckbox v-model="urgent" label="Bloqueia meu trabalho" />
        <FwRadio v-model="channel" name="canal" value="chat" label="Chat" />
        <FwRadio v-model="channel" name="canal" value="email" label="E-mail" />
        <FwSwitch v-model="notify" label="Avisar por e-mail" />
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <FwSectionLabel :number="5">Seleção e status</FwSectionLabel>
      <FwTabs
        v-model="tab"
        label="Filtro de chamados"
        :items="[
          { value: 'open', label: 'Abertos' },
          { value: 'progress', label: 'Em atendimento' },
          { value: 'done', label: 'Resolvidos' },
        ]"
      />
      <FwTabs
        v-model="tab"
        variant="neutral"
        label="Filtro neutro"
        :items="[
          { value: 'open', label: 'Abertos' },
          { value: 'progress', label: 'Em atendimento' },
          { value: 'done', label: 'Resolvidos' },
        ]"
      />
      <div class="fw-row">
        <FwTag>Rede</FwTag>
        <FwTag selected>Selecionada</FwTag>
        <FwTag size="sm" system>TKT-0042</FwTag>
        <FwTag size="sm"><FwIcon name="check" size="sm" /> Resolvido</FwTag>
      </div>
      <FwStepper
        :current="1"
        :steps="[
          { title: 'Aberto', description: 'Chamado recebido' },
          { title: 'Em atendimento', description: 'Técnico responsável' },
          { title: 'Resolvido', description: 'Solução enviada' },
          { title: 'Fechado', description: 'Confirmado pelo cliente' },
        ]"
      />
    </section>

    <section class="flex flex-col gap-4">
      <FwSectionLabel :number="6">Cards e listas</FwSectionLabel>
      <div class="grid gap-4 md:grid-cols-3">
        <FwMetricCard value="12" label="Chamados abertos" icon="inbox" kicker="Fila" />
        <FwFeatureCard
          title="Base de conhecimento"
          description="Respostas prontas para as perguntas mais comuns."
          icon="file"
          kicker="FAQ"
        >
          <template #action><FwButton size="sm" arrow>Ver artigos</FwButton></template>
        </FwFeatureCard>
        <div class="overflow-hidden rounded-md border border-line">
          <FwMedia ratio="16 / 9" label="16:9" />
        </div>
      </div>
      <div class="fw-list">
        <FwListRow
          title="Não consigo acessar o e-mail"
          subtitle="TKT-0042 · aberto há 2 h"
          href="#"
        />
        <FwListRow
          title="Impressora do 2º andar"
          subtitle="TKT-0041 · em atendimento"
          href="#"
          thumb
        />
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <FwSectionLabel :number="7">Marca</FwSectionLabel>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="grid place-items-center rounded-md border border-line bg-surface p-6">
          <FwLogo :height="48" />
        </div>
        <div class="grid place-items-center rounded-md border border-line bg-surface p-6">
          <FwLogo variant="symbol" :height="48" />
        </div>
        <div class="grid place-items-center rounded-md bg-accent p-6 text-on-accent">
          <FwLogo mono :height="48" />
        </div>
        <div class="flex items-center gap-3 rounded-md border border-line bg-surface p-6">
          <img src="/brand/wen-96.webp" alt="" width="48" height="48" class="rounded-md" />
          <span class="font-display text-lg font-bold">Wen</span>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <FwSectionLabel :number="8">Ícones</FwSectionLabel>
      <div class="grid grid-cols-4 gap-3 sm:grid-cols-8 lg:grid-cols-11">
        <div
          v-for="name in ICON_NAMES"
          :key="name"
          class="flex flex-col items-center gap-2 rounded-md border border-line bg-surface p-3"
        >
          <FwIcon :name="name" size="lg" />
          <code class="font-mono text-[10px] text-ink-muted">{{ name }}</code>
        </div>
      </div>
    </section>
  </div>
</template>
