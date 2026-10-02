<script setup lang="ts">
import { FwButton, FwIconButton, FwLogo } from '@f-desk/ui'
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import AnchorLink from '../features/landing/components/AnchorLink.vue'
import UserMenu from '../components/UserMenu.vue'
import { landing } from '../features/landing/landing-content'
import '../features/landing/landing.css'
import { useSessionStore } from '../stores/session'

/** Layout da landing page: topo fixo com âncoras das seções, conteúdo e rodapé. */
const session = useSessionStore()
const route = useRoute()
const year = new Date().getFullYear()

const main = useTemplateRef<HTMLElement>('main')
const menuButton = useTemplateRef<InstanceType<typeof FwIconButton>>('menuButton')
const menuOpen = ref(false)

/** Leva o foco ao conteúdo (o link "Pular para o conteúdo" não pode depender do hash da rota). */
function skipToContent() {
  main.value?.focus()
  main.value?.scrollIntoView()
}

function closeMenu(returnFocus = false) {
  if (!menuOpen.value) return
  menuOpen.value = false
  if (returnFocus) nextTick(() => (menuButton.value?.$el as HTMLElement | undefined)?.focus())
}

watch(
  () => route.fullPath,
  () => closeMenu(),
)
</script>

<template>
  <div class="landing-shell">
    <a href="#conteudo" class="landing-skip" @click.prevent="skipToContent"
      >Pular para o conteúdo</a
    >

    <div class="landing-header-wrap">
      <header class="fw-header landing-header" @keydown.esc="closeMenu(true)">
        <RouterLink to="/" class="fw-header-brand"><FwLogo /></RouterLink>
        <nav class="fw-nav" aria-label="Seções da página">
          <AnchorLink v-for="item in landing.nav" :key="item.id" :target="item.id">
            {{ item.label }}
          </AnchorLink>
        </nav>
        <div class="fw-header-actions">
          <ThemeToggle />
          <UserMenu v-if="session.user" />
          <!-- O CSS do design system não fica em layer: a visibilidade vai num wrapper, não no Fw*. -->
          <span class="contents max-sm:hidden">
            <FwButton v-if="!session.user" variant="ghost" size="sm" :to="{ name: 'sign-in' }">
              Entrar
            </FwButton>
            <FwButton size="sm" :to="{ name: 'chat' }">{{ landing.hero.primary }}</FwButton>
          </span>
          <span class="contents lg:hidden">
            <FwIconButton
              ref="menuButton"
              :icon="menuOpen ? 'close' : 'menu'"
              :label="menuOpen ? 'Fechar menu' : 'Abrir menu'"
              :aria-expanded="menuOpen ? 'true' : 'false'"
              aria-controls="menu-da-pagina"
              size="sm"
              @click="menuOpen = !menuOpen"
            />
          </span>
        </div>
        <nav
          v-show="menuOpen"
          id="menu-da-pagina"
          class="landing-mobile-menu lg:hidden"
          aria-label="Menu"
        >
          <AnchorLink
            v-for="item in landing.nav"
            :key="item.id"
            :target="item.id"
            class="landing-mobile-link"
            @navigate="closeMenu()"
          >
            {{ item.label }}
          </AnchorLink>
          <div class="flex flex-col gap-2 border-t border-line pt-3">
            <FwButton :to="{ name: 'chat' }" class="w-full">{{ landing.hero.primary }}</FwButton>
            <FwButton
              v-if="!session.user"
              :to="{ name: 'sign-in' }"
              variant="secondary"
              class="w-full"
            >
              Entrar
            </FwButton>
          </div>
        </nav>
      </header>
    </div>

    <main id="conteudo" ref="main" tabindex="-1" class="landing-main">
      <RouterView />
    </main>

    <footer class="landing-footer">
      <div class="flex flex-col items-start gap-3">
        <FwLogo :height="28" />
        <p class="m-0 text-sm text-ink-muted">{{ landing.footer.tagline }}</p>
      </div>
      <nav aria-label="Rodapé" class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <RouterLink :to="{ name: 'chat' }">Atendimento</RouterLink>
        <AnchorLink target="planos">Planos</AnchorLink>
        <RouterLink :to="{ name: 'sign-in' }">Entrar</RouterLink>
        <RouterLink :to="{ name: 'sign-up' }">Criar conta</RouterLink>
      </nav>
      <p class="m-0 font-mono text-xs text-ink-muted">
        © {{ year }} F.Wendler. {{ landing.footer.rights }}
      </p>
    </footer>
  </div>
</template>
