export { db, type Database } from './client'
export { consumeChatQuota, saveChatExchange, type ChatExchange } from './queries/chat'
export {
  addClientReply,
  closeClientTicket,
  createTicket,
  getClientTicket,
  getConversation,
  listClientTickets,
  listConversations,
  TICKET_SCOPES,
  type ClientReplyResult,
  type NewTicket,
  type TicketScope,
} from './queries/tickets'
export { countActiveAdmins, findUserAccess, listUsers, type ListUsersParams } from './queries/users'
export * as schema from './schema'
