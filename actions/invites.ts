'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth, isSuperAdmin } from '@/lib/supabase/types'
import { randomBytes } from 'crypto'

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(24).toString('hex') // 48 char hex string
}

// ── Super-admin: create invite ────────────────────────────────────────────────

export async function createInvite({
  plan = 'agency',
  email,
  expiresInDays,
}: {
  plan?: string
  email?: string
  expiresInDays?: number
}) {
  const user = await requireAuth()
  const admin = createAdminClient()

  // Only super-admins can create invites
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const token      = generateToken()
  const expires_at = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { data, error } = await admin
    .from('organization_invites')
    .insert({
      token,
      plan,
      email: email?.trim().toLowerCase() || null,
      expires_at,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, invite: data }
}

// ── Super-admin: list invites ─────────────────────────────────────────────────

export async function listInvites() {
  await requireAuth()
  const admin = createAdminClient()

  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado', invites: [] }

  const { data } = await admin
    .from('organization_invites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return { ok: true as const, invites: data || [] }
}

// ── Super-admin: delete / revoke invite ───────────────────────────────────────

export async function revokeInvite(inviteId: string) {
  await requireAuth()
  const admin = createAdminClient()

  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const { error } = await admin
    .from('organization_invites')
    .delete()
    .eq('id', inviteId)
    .is('used_at', null) // can't revoke already-used invites

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

// ── Public: validate an invite token ─────────────────────────────────────────
// Called from the invite landing page — no auth required.

export async function validateInvite(token: string) {
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('organization_invites')
    .select('id, plan, email, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return { ok: false as const, error: 'Convite inválido ou expirado.' }
  if (invite.used_at) return { ok: false as const, error: 'Este convite já foi utilizado.' }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { ok: false as const, error: 'Este convite expirou.' }
  }

  return { ok: true as const, invite }
}

// ── Signup: redeem an invite after org creation ───────────────────────────────

export async function redeemInvite(token: string, orgId: string) {
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('organization_invites')
    .select('id, plan, email, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite || invite.used_at) return { ok: false as const }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { ok: false as const }
  }

  // Mark used
  await admin
    .from('organization_invites')
    .update({ used_at: new Date().toISOString(), used_by_org: orgId })
    .eq('id', invite.id)

  // Upgrade the org to the invited plan
  await admin
    .from('organizations')
    .update({
      plan:                     invite.plan,
      subscription_status:      'no_billing',
      billing_managed_externally: true,
      trial_ends_at:            null,
      limit_leads:              null, // unlimited
    })
    .eq('id', orgId)

  return { ok: true as const, plan: invite.plan }
}
