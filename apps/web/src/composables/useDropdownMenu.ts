import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Estado e teclado de um menu suspenso (`role="menu"`): abre/fecha, fecha com clique fora,
 * Esc e mudança de rota, e navega entre `[role="menuitem"]` com as setas.
 */
export function useDropdownMenu(root: Ref<HTMLElement | null>, trigger: Ref<HTMLElement | null>) {
  const open = ref(false)
  const route = useRoute()

  function items(): HTMLElement[] {
    return Array.from(
      root.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    )
  }

  async function toggle(focusFirst = false) {
    open.value = !open.value
    if (open.value && focusFirst) {
      await nextTick()
      items()[0]?.focus()
    }
  }

  function close(returnFocus = false) {
    if (!open.value) return
    open.value = false
    if (returnFocus) trigger.value?.focus()
  }

  function moveFocus(delta: number) {
    const list = items()
    if (!list.length) return
    const index = list.indexOf(document.activeElement as HTMLElement)
    list[(index + delta + list.length) % list.length]?.focus()
  }

  function onDocumentClick(event: MouseEvent) {
    if (!root.value?.contains(event.target as Node)) close()
  }

  watch(open, (value) => {
    if (value) document.addEventListener('click', onDocumentClick)
    else document.removeEventListener('click', onDocumentClick)
  })
  watch(
    () => route.fullPath,
    () => close(),
  )
  onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

  return { open, toggle, close, moveFocus }
}
