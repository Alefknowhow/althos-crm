import type { createAdminClient } from '@/lib/supabase/server'

const PER_PAGE = 1000
const MAX_PAGES = 50 // teto de segurança (50k usuários) — evita loop infinito

/**
 * Busca um usuário do Auth por e-mail, paginando `listUsers()` até encontrar
 * ou esgotar as páginas — a API do GoTrue não expõe filtro por e-mail no
 * client-side supabase-js, só listUsers({ page, perPage }) paginado (default
 * 50/página). Checar só a primeira página (como o código fazia antes) dá
 * falso-negativo assim que a base passa de ~50 contas.
 */
export async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error || !data?.users) break
    const match = data.users.find(u => (u.email ?? '').toLowerCase() === target)
    if (match) return match
    if (data.users.length < PER_PAGE) break // última página
  }
  return null
}
