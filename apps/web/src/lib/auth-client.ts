import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

/**
 * Cliente do better-auth. Mesmo domínio da API (proxy do Vite em dev, rewrite na Vercel),
 * então o cookie de sessão é first-party.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [adminClient()],
})
