<script setup lang="ts">
import { TICKET_STATUS_LABEL, isTicketActive, type TicketStatus } from '@f-desk/shared'
import { FwTag } from '@f-desk/ui'

/** Status do chamado. Os que ainda pedem ação ficam em destaque. */
defineProps<{ status: TicketStatus }>()
</script>

<template>
  <FwTag size="sm" :selected="isTicketActive(status)">{{ TICKET_STATUS_LABEL[status] }}</FwTag>
</template>
