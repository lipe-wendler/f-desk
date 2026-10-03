export { db, type Database } from './client'
export {
  consumeChatQuota,
  getConversationHistory,
  importConversation,
  saveChatExchange,
  saveConversationFeedback,
  type ChatExchange,
  type ConversationFeedback,
} from './queries/chat'
export {
  addStaffReply,
  getStaffMetrics,
  getStaffTicket,
  listAssignees,
  listStaffTickets,
  updateStaffTicket,
  type StaffQueueParams,
  type StaffReplyResult,
  type StaffUpdateResult,
} from './queries/staff-tickets'
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
