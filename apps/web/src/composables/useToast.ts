import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  tone: 'success' | 'danger'
}

const toasts = ref<Toast[]>([])
let next = 0

/** Avisos curtos de confirmação (ex.: "Perfil alterado."), lidos por leitores de tela. */
export function useToast() {
  function show(message: string, tone: Toast['tone'] = 'success') {
    const id = ++next
    toasts.value.push({ id, message, tone })
    setTimeout(() => dismiss(id), 4000)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  return { toasts, show, dismiss }
}
