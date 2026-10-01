import { ref } from 'vue'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'f-desk:theme'
const theme = ref<Theme>('dark')

function apply(value: Theme) {
  theme.value = value
  document.documentElement.dataset.theme = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Armazenamento indisponível (modo privado): o tema vale só para esta sessão.
  }
}

/** Tema atual (`data-theme` no `<html>`). Dark é o padrão da marca. */
export function useTheme() {
  return {
    theme,
    setTheme: apply,
    toggleTheme: () => apply(theme.value === 'dark' ? 'light' : 'dark'),
    /** Lê a preferência salva; chame uma vez no boot do app. */
    restoreTheme: () => {
      let saved: string | null
      try {
        saved = localStorage.getItem(STORAGE_KEY)
      } catch {
        saved = null
      }
      apply(saved === 'light' ? 'light' : 'dark')
    },
  }
}
