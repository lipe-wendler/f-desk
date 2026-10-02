import type { RouteRecordRaw } from 'vue-router'

const CLIENT = ['client'] as const
const STAFF = ['technician', 'admin'] as const
const ADMIN = ['admin'] as const

export const routes: RouteRecordRaw[] = [
  // Landing page: aberta para todos, logados ou não.
  {
    path: '/',
    component: () => import('../layouts/LandingLayout.vue'),
    children: [
      {
        path: '',
        name: 'landing',
        component: () => import('../features/landing/LandingPage.vue'),
        meta: { title: 'Suporte que resolve' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('../layouts/PublicLayout.vue'),
    children: [
      // Público: visitante tira dúvidas no chatbot sem criar conta.
      {
        path: 'atendimento',
        name: 'chat',
        component: () => import('../features/chat/ChatPage.vue'),
        meta: { title: 'Atendimento' },
      },
      // Cliente logado: abrir chamado e histórico.
      {
        path: 'chamados',
        name: 'tickets',
        component: () => import('../features/tickets/TicketsPage.vue'),
        meta: { roles: CLIENT, title: 'Meus chamados' },
      },
      {
        path: 'chamados/novo',
        name: 'ticket-new',
        component: () => import('../features/tickets/NewTicketPage.vue'),
        meta: { roles: CLIENT, title: 'Abrir chamado' },
      },
      {
        path: 'chamados/:id',
        name: 'ticket',
        component: () => import('../features/tickets/TicketPage.vue'),
        meta: { roles: CLIENT, title: 'Chamado' },
      },
      {
        path: 'conversas',
        name: 'conversations',
        component: () => import('../features/tickets/ConversationsPage.vue'),
        meta: { roles: CLIENT, title: 'Minhas conversas' },
      },
      {
        path: 'acesso-negado',
        name: 'forbidden',
        component: () => import('../pages/ForbiddenPage.vue'),
        meta: { title: 'Acesso negado' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('../layouts/AuthLayout.vue'),
    children: [
      {
        path: 'entrar',
        name: 'sign-in',
        component: () => import('../features/auth/SignInPage.vue'),
        meta: { guestOnly: true, title: 'Entrar' },
      },
      {
        path: 'criar-conta',
        name: 'sign-up',
        component: () => import('../features/auth/SignUpPage.vue'),
        meta: { guestOnly: true, title: 'Criar conta' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('../layouts/StaffLayout.vue'),
    children: [
      {
        path: 'tecnico',
        name: 'staff-dashboard',
        component: () => import('../features/dashboard/DashboardPage.vue'),
        meta: { roles: STAFF, title: 'Dashboard' },
      },
      {
        path: 'tecnico/chamados/:id',
        name: 'staff-ticket',
        component: () => import('../features/dashboard/StaffTicketPage.vue'),
        meta: { roles: STAFF, title: 'Chamado' },
      },
      {
        path: 'admin/usuarios',
        name: 'admin-users',
        component: () => import('../features/admin-users/UsersPage.vue'),
        meta: { roles: ADMIN, title: 'Usuários' },
      },
    ],
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/design-system',
          name: 'design-system',
          component: () => import('../pages/DesignSystemPage.vue'),
          meta: { title: 'Design system' },
        },
      ]
    : []),
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/NotFoundPage.vue'),
    meta: { title: 'Página não encontrada' },
  },
]
