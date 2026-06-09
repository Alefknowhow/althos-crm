import { redirect } from 'next/navigation'

// Organizações foi unificada na aba Usuários & Contas (controle por conta).
export default function SuperAdminOrgsPage() {
  redirect('/super-admin/users')
}
