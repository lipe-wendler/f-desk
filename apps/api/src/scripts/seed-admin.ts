// Cria o primeiro admin da plataforma. Os demais admins e técnicos são criados por ele
// na tela de gestão de usuários. Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter api seed:admin
import { auth } from '../auth'

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME ?? 'Admin F.Desk'

if (!email || !password) {
  console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (no .env ou na linha de comando).')
  process.exit(1)
}

// Chamado no servidor, sem headers, o createUser do plugin admin não exige sessão.
const { user } = await auth.api.createUser({ body: { email, password, name, role: 'admin' } })
console.log(`✓ Admin criado: ${user.email} (${user.id})`)
