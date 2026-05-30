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

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = await requireAuth()
  if (newPassword.length < 8)
    return { ok: false as const, error: 'A nova senha precisa ter pelo menos 8 caracteres.' }
  if (!currentPassword)
    return { ok: false as const, error: 'Informe sua senha atual.' }
  if (currentPassword === newPassword)
    return { ok: false as const, error: 'A nova senha deve ser diferente da atual.' }

  const supabase = createClient()

  // SECURITY: re-authenticate with the current password before allowing a
  // password change. Supabase's updateUser({ password }) alone does NOT verify
  // the old password, so without this an attacker with a hijacked session could
  // lock the real owner out. signInWithPassword fails on a wrong password.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email ?? '',
    password: currentPassword,
  })
  if (reauthError) {
    return { ok: false as const, error: 'Senha atual incorreta.' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
