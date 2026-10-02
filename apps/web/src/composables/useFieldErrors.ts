import { ref, watch } from 'vue'

/**
 * Erros por campo de um formulário reativo: some o erro de um campo assim que ele é editado,
 * para a mensagem não ficar na tela depois de corrigida.
 */
export function useFieldErrors<T extends object>(form: T) {
  const errors = ref<Record<string, string>>({})
  watch(
    () => ({ ...form }) as Record<string, unknown>,
    (next, prev) => {
      const changed = Object.keys(next).filter((key) => next[key] !== prev[key])
      if (changed.some((key) => errors.value[key])) {
        errors.value = Object.fromEntries(
          Object.entries(errors.value).filter(([key]) => !changed.includes(key)),
        )
      }
    },
  )
  return errors
}
