'use server'

/**
 * Listing members for pickers, inviting new members, updating
 * permissions/goal/org-visibility. Split out of actions/team.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { getResend, EMAIL_FROM } from '@/lib/resend'
import { type Permissions, allPermissions, defaultMemberPermissions } from '@/lib/permissions'
import { getProfilesMap } from '@/lib/profiles'
import { isAccountManager } from './team-shared'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://althoscrm.com.br'

/** Lightweight member list for assignee pickers (tasks, leads, etc.). */
export async function listOrgMembers(
  orgSlug: string,
): Promise<{ user_id: string; name: string; email: string }[]> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('memberships')
    .select('user_id, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })

  const profiles = await getProfilesMap((memberships ?? []).map(m => m.user_id))
  return (memberships ?? []).map(m => {
    const p = profiles.get(m.user_id)
    return {
      user_id: m.user_id,
      email: p?.email ?? '',
      name: p?.full_name || p?.email?.split('@')[0] || 'Usuário',
    }
  })
}

// ── Invite ────────────────────────────────────────────────────────────────────

export async function inviteTeamMember(
  orgSlug:     string,
  email:       string,
  role:        'admin' | 'member',
  permissions: Permissions,
) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  const accountId = ((org as any).account_id as string | null) ?? null

  const cleanEmail = email.toLowerCase().trim()

  // Only account managers (owner/admin) may invite.
  if (accountId) {
    const manager = await isAccountManager(admin, accountId, user.id)
    if (!manager) {
      return { ok: false as const, error: 'Apenas administradores da conta podem convidar usuários.' }
    }
  }

  // ── Seat check (account-level) ──────────────────────────────────────────────
  // Limit comes from the account's plan (max_users). -1 = unlimited.
  if (accountId) {
    const { data: limitRow } = await admin.rpc('account_user_limit', { p_account_id: accountId })
    const seatLimit = typeof limitRow === 'number' ? limitRow : 1

    if (seatLimit !== -1) {
      const { data: limitCount } = await admin.rpc('account_user_count', { p_account_id: accountId })
      const used = typeof limitCount === 'number' ? limitCount : 0

      // Pending invites across the account (deduped by email, excluding this one).
      const { data: orgRows } = await admin
        .from('organizations')
        .select('id')
        .eq('account_id', accountId)
      const orgIds = (orgRows ?? []).map(o => o.id)
      let pending = 0
      if (orgIds.length) {
        const { data: invs } = await admin
          .from('invitations')
          .select('email')
          .in('organization_id', orgIds)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
        const emails = new Set((invs ?? []).map(i => i.email.toLowerCase()))
        emails.delete(cleanEmail) // re-inviting the same email doesn't add a seat
        pending = emails.size
      }

      if (used + pending >= seatLimit) {
        return {
          ok: false as const,
          error: `Limite de ${seatLimit} usuário(s) do plano atingido. Faça upgrade para adicionar mais.`,
        }
      }
    }
  } else {
    // Legacy org-level fallback.
    const { count: memberCount } = await admin
      .from('memberships').select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
    const { count: inviteCount } = await admin
      .from('invitations').select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id).is('accepted_at', null).gt('expires_at', new Date().toISOString())
    const limit = (org as any).limit_users ?? 1
    if ((memberCount ?? 0) + (inviteCount ?? 0) >= limit) {
      return { ok: false as const, error: `Limite de ${limit} usuários atingido no plano atual.` }
    }
  }

  // Prevent inviting someone who is already in the account/org.
  const { data: existing } = await admin.auth.admin.listUsers()
  const existingUser = existing?.users?.find(u => u.email === cleanEmail)
  if (existingUser) {
    if (accountId) {
      const { data: am } = await admin
        .from('account_members')
        .select('user_id')
        .eq('account_id', accountId)
        .eq('user_id', existingUser.id)
        .maybeSingle()
      if (am) return { ok: false as const, error: 'Este usuário já faz parte da conta.' }
    } else {
      const { data: existingMembership } = await admin
        .from('memberships')
        .select('id')
        .eq('organization_id', org.id)
        .eq('user_id', existingUser.id)
        .maybeSingle()
      if (existingMembership) {
        return { ok: false as const, error: 'Este usuário já é membro da organização.' }
      }
    }
  }

  // Upsert invitation (anchored to the current org; acceptance fans out to all).
  const { data: inv, error } = await admin
    .from('invitations')
    .upsert(
      {
        organization_id: org.id,
        invited_by:      user.id,
        email:           cleanEmail,
        role,
        permissions:     role === 'admin' ? allPermissions() : permissions,
        expires_at:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        accepted_at:     null,
      },
      { onConflict: 'organization_id,email', ignoreDuplicates: false },
    )
    .select('token')
    .single()

  if (error || !inv) {
    return { ok: false as const, error: error?.message ?? 'Erro ao criar convite.' }
  }

  // Send email (best-effort).
  try {
    const inviteUrl = `${APP_URL}/convite/${inv.token}`
    const orgName   = (org as any).name ?? orgSlug
    await getResend().emails.send({
      from:    EMAIL_FROM,
      to:      email,
      subject: `Você foi convidado para ${orgName} no Althos CRM`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:22px;font-weight:800;margin-bottom:8px">Althos CRM</h1>
          <p style="color:#6b7280;margin-bottom:24px">Convite para colaborar</p>
          <p>Você foi convidado para acessar o workspace <strong>${orgName}</strong> no Althos CRM como <strong>${role === 'admin' ? 'Administrador' : 'Membro'}</strong>.</p>
          <a href="${inviteUrl}"
             style="display:inline-block;margin-top:20px;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
            Aceitar convite
          </a>
          <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
            Este link expira em 7 dias. Se você não esperava este convite, pode ignorar este e-mail.
          </p>
        </div>
      `,
    })
  } catch (e) {
    console.error('invite email error:', e)
  }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  return { ok: true as const }
}

// ── Update member permissions (current org) ────────────────────────────────────

export async function updateMemberPermissions(
  orgSlug:      string,
  membershipId: string,
  permissions:  Permissions,
  role?:        'admin' | 'member',
) {
  await requireAuth()
  const org   = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  const update: any = { permissions }
  if (role) update.role = role

  const { error } = await admin
    .from('memberships')
    .update(update)
    .eq('id', membershipId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  return { ok: true as const }
}

/** Meta mensal individual do vendedor (Configurações › Equipe). null = volta
 *  a usar o fallback (meta da empresa ÷ nº de vendedores ativos). */
export async function updateMemberMonthlyGoal(
  orgSlug:      string,
  membershipId: string,
  goalCents:    number | null,
) {
  await requireAuth()
  const org   = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  const { error } = await admin
    .from('memberships')
    .update({ monthly_goal_cents: goalCents })
    .eq('id', membershipId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}

// ── Per-org visibility toggle (account managers only) ──────────────────────────

export async function setOrgVisibility(
  orgSlug:      string,
  targetUserId: string,
  targetOrgId:  string,
  hidden:       boolean,
) {
  const user = await requireAuth()
  const org   = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  const accountId = ((org as any).account_id as string | null) ?? null

  if (!accountId) {
    return { ok: false as const, error: 'Visibilidade por organização requer uma conta.' }
  }

  // Authorize: only account owner/admin.
  if (!(await isAccountManager(admin, accountId, user.id))) {
    return { ok: false as const, error: 'Apenas administradores da conta podem alterar a visibilidade.' }
  }

  // The target org must belong to this account.
  const { data: targetOrg } = await admin
    .from('organizations')
    .select('id, account_id')
    .eq('id', targetOrgId)
    .maybeSingle()
  if (!targetOrg || targetOrg.account_id !== accountId) {
    return { ok: false as const, error: 'Organização inválida.' }
  }

  // Account managers/owner always retain full visibility — can't be hidden.
  const { data: account } = await admin
    .from('accounts').select('owner_user_id').eq('id', accountId).maybeSingle()
  if (account?.owner_user_id === targetUserId) {
    return { ok: false as const, error: 'O proprietário da conta sempre enxerga todas as organizações.' }
  }
  const { data: targetAm } = await admin
    .from('account_members').select('role').eq('account_id', accountId).eq('user_id', targetUserId).maybeSingle()
  if (targetAm?.role === 'admin' && hidden) {
    return { ok: false as const, error: 'Administradores da conta enxergam todas as organizações.' }
  }

  // Update existing membership, or create one if missing (keeps "present in all orgs").
  const { data: existing } = await admin
    .from('memberships')
    .select('id')
    .eq('organization_id', targetOrgId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('memberships')
      .update({ hidden })
      .eq('id', existing.id)
    if (error) return { ok: false as const, error: error.message }
  } else {
    const { error } = await admin
      .from('memberships')
      .insert({
        organization_id: targetOrgId,
        user_id:         targetUserId,
        role:            'member',
        permissions:     defaultMemberPermissions(),
        hidden,
      })
    if (error) return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  return { ok: true as const }
}
