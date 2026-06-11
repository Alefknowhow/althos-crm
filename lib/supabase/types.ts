import { cache } from 'react'
import { createClient } from './server'
import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'

// Memoizado por requisição (React cache): layout, Sidebar e a page chamam
// requireAuth/getUser cada um por conta própria. Sem o cache, cada chamada
// fazia uma ida-e-volta de rede ao Auth do Supabase para validar o JWT
// (auth.getUser não lê cookie local). Com o cache, é 1 validação por request.
export const getUser = cache(async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

// Memoizado por requisição e por slug: layout + Sidebar + page buscavam a mesma
// org 3x (SELECT * em organizations) na mesma renderização. cache() colapsa
// para 1 query por slug/request.
export const getCurrentOrganization = cache(async (slug: string) => {
  const supabase = createClient()
  // requireAuth() already redirects unauthenticated users to /login.
  await requireAuth()

  // RLS guarantees the user only sees the org if they are a member. If the row
  // is missing it means either the org doesn't exist OR the user isn't a member
  // — both are a 404 (notFound), NOT a /login bounce. A login redirect here
  // would mask membership/RLS issues and loop already-authenticated users.
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !org) {
    notFound()
  }

  return org
})

export async function isSuperAdmin() {
  const user = await getUser()
  // SECURITY: only trust `app_metadata`, which is writable exclusively by the
  // service-role key / Supabase admin API — never by the user themselves.
  // `user_metadata` (raw_user_meta_data) is self-editable via
  // supabase.auth.updateUser({ data }) and must NEVER gate privilege.
  const appMeta = user?.app_metadata as { role?: string; is_super_admin?: boolean } | undefined
  return appMeta?.role === 'super_admin' || appMeta?.is_super_admin === true
}

export function isImpersonating() {
  return !!cookies().get('impersonated_org_id')?.value
}
