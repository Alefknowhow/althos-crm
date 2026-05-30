'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserProfile = {
  id:         string
  email:      string
  name:       string
  phone:      string
  avatar_url: string | null
  memberships: Array<{
    role: string
    organizations: { id: string; name: string; slug: string } | null
  }>
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: memberships } = await supabase
    .from('memberships')
    .select('role, organizations(id, name, slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return {
    id:         user.id,
    email:      user.email ?? '',
    name:       (user.user_metadata?.name  as string) ?? '',
    phone:      (user.user_metadata?.phone as string) ?? '',
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    memberships: (memberships ?? []) as unknown as UserProfile['memberships'],
  }
}

// ── Update name / phone ───────────────────────────────────────────────────────

export async function updateProfileInfo(name: string, phone: string) {
  await requireAuth()
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ data: { name, phone } })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

// ── Request email change ──────────────────────────────────────────────────────
// Supabase sends a confirmation link to the NEW address; only swaps after click.

export async function requestEmailChange(newEmail: string) {
  await requireAuth()
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser(
    { email: newEmail.trim().toLowerCase() },
  )
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

// ── Change password ───────────────────────────────────────────────────────────

export async function changePassword(newPassword: string) {
  await requireAuth()
  if (newPassword.length < 8)
    return { ok: false as const, error: 'A senha precisa ter pelo menos 8 caracteres.' }
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
