import type { InjectionKey } from 'vue'

/** O layout do atendimento expõe o drawer de conversas para o botão de menu do cabeçalho. */
export interface ConversationsDrawer {
  /** Abre o drawer; `trigger` recebe o foco de volta quando ele fecha. */
  open: (trigger: HTMLElement | null) => void
}

export const CONVERSATIONS_DRAWER: InjectionKey<ConversationsDrawer> =
  Symbol('conversations-drawer')
