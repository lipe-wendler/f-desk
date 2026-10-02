<script setup lang="ts">
import { FwButton, FwIcon } from '@f-desk/ui'
import { ref } from 'vue'
import LandingSection from '../components/LandingSection.vue'
import { landing, type Billing, type Plan } from '../landing-content'
import { formatBRL, planPrice, yearlyPerMonth } from '../pricing'

const { pricing: content } = landing
const billing = ref<Billing>('monthly')

const options: { value: Billing; label: string; badge?: string }[] = [
  { value: 'monthly', label: content.monthly },
  { value: 'yearly', label: content.yearly, badge: content.yearlyBadge },
]

function priceText(plan: Plan) {
  if (plan.monthly === 0) return content.free
  return formatBRL(planPrice(plan, billing.value))
}

function periodText(plan: Plan) {
  if (plan.monthly === 0) return ''
  return billing.value === 'yearly' ? content.perYear : content.perMonth
}

/** Frase completa para leitores de tela: "Pro, R$ 149 por mês". */
function priceLabel(plan: Plan) {
  if (plan.monthly === 0) return `${plan.name}, grátis`
  const period = billing.value === 'yearly' ? 'por ano' : 'por mês'
  return `${plan.name}, ${formatBRL(planPrice(plan, billing.value))} ${period}`
}
</script>

<template>
  <LandingSection
    id="planos"
    :number="5"
    :eyebrow="content.eyebrow"
    :title="content.title"
    :lead="content.lead"
  >
    <fieldset class="landing-billing">
      <legend class="sr-only">{{ content.billingLabel }}</legend>
      <label v-for="option in options" :key="option.value" class="landing-billing-option">
        <input v-model="billing" type="radio" name="billing" :value="option.value" />
        <span>{{ option.label }}</span>
        <span v-if="option.badge" class="landing-billing-badge">{{ option.badge }}</span>
      </label>
    </fieldset>
    <p class="sr-only" aria-live="polite">
      {{
        billing === 'yearly'
          ? 'Mostrando preços do plano anual.'
          : 'Mostrando preços do plano mensal.'
      }}
    </p>

    <ul class="landing-plans">
      <li
        v-for="plan in content.plans"
        :key="plan.id"
        class="landing-plan fw-card"
        :class="{ 'landing-plan-featured': plan.featured }"
      >
        <span v-if="plan.featured" class="landing-plan-badge">{{ content.featuredBadge }}</span>
        <h3 :id="`plano-${plan.id}`" class="fw-card-title">{{ plan.name }}</h3>
        <p class="fw-card-body">{{ plan.description }}</p>
        <p class="landing-plan-price">
          <span class="sr-only">{{ priceLabel(plan) }}</span>
          <span aria-hidden="true">
            <span class="landing-plan-value">{{ priceText(plan) }}</span>
            <span class="text-ink-muted">{{ periodText(plan) }}</span>
          </span>
        </p>
        <p
          v-if="billing === 'yearly' && plan.monthly > 0"
          class="m-0 font-mono text-xs text-ink-muted"
        >
          equivale a {{ formatBRL(yearlyPerMonth(plan)) }}/mês
        </p>
        <ul class="flex list-none flex-col gap-2 p-0" aria-label="Inclui">
          <li
            v-for="feature in plan.features"
            :key="feature"
            class="flex items-start gap-2 text-sm"
          >
            <FwIcon name="check" size="sm" class="mt-0.5 flex-none text-accent-text" />
            {{ feature }}
          </li>
        </ul>
        <FwButton
          :to="plan.to"
          :variant="plan.featured ? 'primary' : 'secondary'"
          class="mt-auto w-full"
        >
          {{ plan.cta }}
        </FwButton>
      </li>
    </ul>
  </LandingSection>
</template>
