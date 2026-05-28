import { createClient } from './server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function getCurrentOrganization(slug: string) {
  const supabase = createClient()
  await requireAuth()
  
  // O RLS garante que o usuário só consiga ver a org se for membro.
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()
    
  if (error || !org) {
    redirect('/login')
  }
  
  return org
}

export async function isSuperAdmin() {
  const user = await getUser()
  return user?.user_metadata?.is_super_admin === true
}

export function isImpersonating() {
  return !!cookies().get('impersonated_org_id')?.value
}
