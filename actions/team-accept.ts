'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { fanOutInvitation } from './team-remove'

// ── Accept invitation (called from /convite/[token]) ──────────────────────────

export async function acceptInvitation(token: string) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Você precisa estar logado para aceitar o convite.' }

  const { data: inv } = await admin
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!inv) return { ok: false as const, error: 'Convite inválido ou expirado.' }

  if (inv.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return {
      ok:    false as const,
      error: `Este convite foi enviado para ${inv.email}. Faça login com esse e-mail para aceitar.`,
    }
  }

  const slug = await fanOutInvitation(admin, inv, user.id)
  return { ok: true as const, redirectTo: `/app/${slug}` }
}

// ── Status check for the acceptance page (new vs. existing user) ───────────────
/**
 * Returns whether the invited e-mail already has an auth account, so the
 * /convite page can route a brand-new invitee to the lightweight signup form
 * (name + password) instead of a login screen they can't pass.
 */
export async function getInviteeAccountStatus(
  token: string,
): Promise<{ ok: false } | { ok: true; email: string; hasAccount: boolean }> {
  const admin = createAdminClient()
  const { data: inv } = await admin
    .from('invitations')
    .select('email')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (!inv) return { ok: false }

  const { data: list } = await admin.auth.admin.listUsers()
  const hasAccount = !!list?.users?.some(
    u => (u.email ?? '').toLowerCase() === inv.email.toLowerCase(),
  )
  return { ok: true, email: inv.email, hasAccount }
}

// ── New invitee: create account + accept in one step ──────────────────────────
/**
 * Lightweight onboarding for an invited member who has no account yet. Unlike
 * the account-owner signup (which creates an org + picks a niche/plan), the
 * invitee only supplies their name and a password — their role and org access
 * come from the invitation. Possession of the invite token proves ownership of
 * the e-mail, so the account is created already-confirmed (no second e-mail).
 */
export async function acceptInviteAsNewUser(
  token: string,
  name: string,
  password: string,
  phone: string,
  birthDate: string,
  address: string,
) {
  const admin = createAdminClient()

  const cleanName    = name.trim()
  const cleanPhone   = phone.trim()
  const cleanBirth   = birthDate.trim()
  const cleanAddress = address.trim()
  if (cleanName.length < 2) return { ok: false as const, error: 'Informe seu nome.' }
  if (cleanPhone.length < 8) return { ok: false as const, error: 'Informe um telefone válido.' }
  if (!cleanBirth) return { ok: false as const, error: 'Informe sua data de nascimento.' }
  if (cleanAddress.length < 5) return { ok: false as const, error: 'Informe seu endereço.' }
  if ((password ?? '').length < 8) {
    return { ok: false as const, error: 'A senha deve ter pelo menos 8 caracteres.' }
  }

  const { data: inv } = await admin
    .from('invitations')
    .select('id, email, role, permissions, organization_id, expires_at, accepted_at')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (!inv) return { ok: false as const, error: 'Convite inválido ou expirado.' }

  // Refuse if an account already exists for this e-mail — they must log in.
  const { data: list } = await admin.auth.admin.listUsers()
  const existing = list?.users?.find(
    u => (u.email ?? '').toLowerCase() === inv.email.toLowerCase(),
  )
  if (existing) {
    return {
      ok: false as const,
      error: 'Já existe uma conta com este e-mail. Faça login para aceitar o convite.',
    }
  }

  // Create the user, e-mail pre-confirmed (the invite link proves ownership).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email:         inv.email,
    password,
    email_confirm: true,
    user_metadata: { name: cleanName, phone: cleanPhone, birth_date: cleanBirth, address: cleanAddress },
  })
  if (createErr || !created?.user) {
    return { ok: false as const, error: createErr?.message ?? 'Erro ao criar a conta.' }
  }

  // Keep the profiles mirror in sync (best-effort).
  await admin
    .from('profiles')
    .upsert(
      { id: created.user.id, email: inv.email, full_name: cleanName },
      { onConflict: 'id' },
    )

  const slug = await fanOutInvitation(admin, inv as any, created.user.id)
  return { ok: true as const, email: inv.email, redirectTo: `/app/${slug}/pipeline` }
}

// ── Get invitation info (for the acceptance page) ─────────────────────────────

export async function getInvitationInfo(token: string) {
  const admin = createAdminClient()

  const { data: inv } = await admin
    .from('invitations')
    .select('email, role, organization_id, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (!inv) return null

  const { data: org } = await admin
    .from('organizations')
    .select('name, slug')
    .eq('id', inv.organization_id)
    .single()

  const expired   = new Date(inv.expires_at) < new Date()
  const accepted  = !!inv.accepted_at

  return {
    email:    inv.email,
    role:     inv.role as 'admin' | 'member',
    orgName:  org?.name ?? '',
    orgSlug:  org?.slug ?? '',
    expired,
    accepted,
  }
}
