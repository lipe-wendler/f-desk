/** Separa `*trecho*` do resto do texto para destacar com `fw-hl` sem usar v-html. */
export function splitHighlight(text: string): { text: string; hl: boolean }[] {
  return text
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('*') && part.endsWith('*')
        ? { text: part.slice(1, -1), hl: true }
        : { text: part, hl: false },
    )
}
