<script setup lang="ts">
import AudienceSection from './sections/AudienceSection.vue'
import BeforeAfterSection from './sections/BeforeAfterSection.vue'
import FaqSection from './sections/FaqSection.vue'
import FeaturesSection from './sections/FeaturesSection.vue'
import FinalCtaSection from './sections/FinalCtaSection.vue'
import HeroSection from './sections/HeroSection.vue'
import HowItWorksSection from './sections/HowItWorksSection.vue'
import PricingSection from './sections/PricingSection.vue'
import ProofSection from './sections/ProofSection.vue'
import QuoteSection from './sections/QuoteSection.vue'
import './landing.css'

/** Landing page do F.Desk: apresenta o produto, os planos e leva ao atendimento. */
</script>

<template>
  <div class="landing flex flex-col">
    <HeroSection />
    <ProofSection />
    <BeforeAfterSection />
    <HowItWorksSection />
    <FeaturesSection />
    <AudienceSection />
    <PricingSection />
    <QuoteSection />
    <FaqSection />
    <FinalCtaSection />
  </div>
</template>
