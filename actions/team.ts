'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { getResend } from '@/lib/resend'
import { type Permissions, allPermissions, defaultMemberPermissions } from '@/lib/permissions'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://althoscrm.com.br'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Visibility of a single org for a given user. */
export type MemberOrgVisibility = {
  org_id:         string
  org_name:       string
  membership_id:  string | null
  hidden:         boolean
}

export type TeamMember = {
  user_id:      string
  email:        string
  name:         string
  account_role: 'admin' | 'member'
  is_owner:     boolean
  joined_at:    string
  /** Per-org visibility across the whole account (for the visibility matrix). */
  orgs:         MemberOrgVisibility[]
  /** Membership in the CURRENTLY-open org (used by the permissions dialog). */
  current_org:  { membership_id: string; role: string; permissions: Permissions } | null
}

export type PendingInvitation = {
  id:         string
  email:      string
  role:       string
  permissions: Permissions
  created_at: string
  expires_at: string
}

export type TeamData = {
  members:                  TeamMember[]
  invitations:              PendingInvitation[]
  orgs:                     { id: string; name: string; slug: string }[]
  seatUsed:                 number
  /** -1 = ilimitado. */
  seatLimit:                number
  accountId:                string | null
  currentUserIsManager:     boolean
  org_id:                   string
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/** True if `userId` is the account owner or an account admin. */
async function isAccountManager(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string,
  userId: string,
): Promise<boolean> {
  const { data: acc } = await admin
    .from('accounts')
    .select('owner_user_id')
    .eq('id', accountId)
    .maybeSingle()
  if (acc?.owner_user_id === userId) return true
  const { data: am } = await admin
    .from('account_members')
    .select('role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle()
  return am?.role === 'admin'
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getTeamData(orgSlug: string): Promise<TeamData> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  const accountId = ((org as any).account_id as string | null) ?? null

  // Legacy org without an account: fall back to single-org behaviour.
  if (!accountId) {
    const { data: memberships } = await admin
      .from('memberships')
      .select('id, user_id, role, permissions, created_at, hidden')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: true })

    const members: TeamMember[] = []
    for (const m of memberships ?? []) {
      const { data: { user: u } } = await admin.auth.admin.getUserById(m.user_id)
      members.push({
        user_id:      m.user_id,
        email:        u?.email ?? '',
        name:         (u?.user_metadata?.name as string) ?? '',
        account_role: m.role === 'member' ? 'member' : 'admin',
        is_owner:     m.role === 'owner',
        joined_at:    m.created_at,
        orgs:         [{ org_id: org.id, org_name: (org as any).name ?? orgSlug, membership_id: m.id, hidden: !!(m as any).hidden }],
        current_org:  { membership_id: m.id, role: m.role, permissions: (m.permissions ?? {}) as Permissions },
      })
    }

    const { data: invitations } = await admin
      .from('invitations')
      .select('id, email, role, permissions, created_at, expires_at')
      .eq('organization_id', org.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    return {
      members,
      invitations: (invitations ?? []) as PendingInvitation[],
      orgs: [{ id: org.id, name: (org as any).name ?? orgSlug, slug: orgSlug }],
      seatUsed: members.length + (invitations?.length ?? 0),
      seatLimit: (org as any).limit_users ?? 1,
      accountId: null,
      currentUserIsManager: true,
      org_id: org.id,
    }
  }

  // ── Account-level team ──────────────────────────────────────────────────────
  const { data: accountOrgs } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
  const orgs = (accountOrgs ?? []) as { id: string; name: string; slug: string }[]
  const orgIds = orgs.map(o => o.id)
  const safeOrgIds = orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000']

  const { data: account } = await admin
    .from('accounts')
    .select('owner_user_id')
    .eq('id', accountId)
    .maybeSingle()
  const ownerId = account?.owner_user_id ?? null

  const { data: accMembers } = await admin
    .from('account_members')
    .select('user_id, role, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })

  const { data: allMemberships } = await admin
    .from('memberships')
    .select('id, organization_id, user_id, role, permissions, hidden')
    .in('organization_id', safeOrgIds)

  // The set of people in the account = account_members ∪ anyone with a membership.
  const roleByUser = new Map<string, string>()
  const joinedByUser = new Map<string, string>()
  for (const am of accMembers ?? []) {
    roleByUser.set(am.user_id, am.role)
    joinedByUser.set(am.user_id, am.created_at)
  }
  for (const m of allMemberships ?? []) {
    if (!roleByUser.has(m.user_id)) {
      roleByUser.set(m.user_id, m.role === 'owner' || m.role === 'admin' ? 'admin' : 'member')
    }
  }

  const members: TeamMember[] = []
  for (const userId of Array.from(roleByUser.keys())) {
    const { data: { user: u } } = await admin.auth.admin.getUserById(userId)
    const mine = (allMemberships ?? []).filter(m => m.user_id === userId)
    const cur = mine.find(m => m.organization_id === org.id)
    const accRole = roleByUser.get(userId) === 'admin' ? 'admin' : 'member'
    members.push({
      user_id:      userId,
      email:        u?.email ?? '',
      name:         (u?.user_metadata?.name as string) ?? (u?.user_metadata?.full_name as string) ?? '',
      account_role: accRole,
      is_owner:     userId === ownerId,
      joined_at:    joinedByUser.get(userId) ?? new Date(0).toISOString(),
      orgs: orgs.map(o => {
        const mm = mine.find(m => m.organization_id === o.id)
        return { org_id: o.id, org_name: o.name, membership_id: mm?.id ?? null, hidden: !!mm?.hidden }
      }),
      current_org: cur
        ? { membership_id: cur.id, role: cur.role, permissions: (cur.permissions ?? {}) as Permissions }
        : null,
    })
  }
  members.sort((a, b) => (a.is_owner ? -1 : b.is_owner ? 1 : a.joined_at.localeCompare(b.joined_at)))

  // Pending invitations across the whole account, deduped by email.
  const { data: rawInvs } = await admin
    .from('invitations')
    .select('id, email, role, permissions, created_at, expires_at')
    .in('organization_id', safeOrgIds)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  const seenEmail = new Set<string>()
  const invitations: PendingInvitation[] = []
  for (const inv of rawInvs ?? []) {
    const key = inv.email.toLowerCase()
    if (seenEmail.has(key)) continue
    seenEmail.add(key)
    invitations.push(inv as PendingInvitation)
  }

  const { data: limitRow } = await admin.rpc('account_user_limit', { p_account_id: accountId })
  const seatLimit = typeof limitRow === 'number' ? limitRow : 1
  const seatUsed = members.length + invitations.length

  const currentUserIsManager = await isAccountManager(admin, accountId, user.id)

  return {
    members,
    invitations,
    orgs,
    seatUsed,
    seatLimit,
    accountId,
    currentUserIsManager,
    org_id: org.id,
  }
}

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

  const out: { user_id: string; name: string; email: string }[] = []
  for (const m of memberships ?? []) {
    const { data: { user } } = await admin.auth.admin.getUserById(m.user_id)
    out.push({
      user_id: m.user_id,
      email: user?.email ?? '',
      name: (user?.user_metadata?.name as string) || user?.email?.split('@')[0] || 'Usuário',
    })
  }
  return out
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
      from:    'Althos CRM <noreply@althos.com.br>',
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

// ── Remove member (from the whole account) ─────────────────────────────────────

export async function removeMember(orgSlug: string, targetUserId: string) {
  const user = await requireAuth()
  const org   = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  const accountId = ((org as any).account_id as string | null) ?? null

  if (accountId) {
    if (!(await isAccountManager(admin, accountId, user.id))) {
      return { ok: false as const, error: 'Apenas administradores da conta podem remover usuários.' }
    }

    // Never remove the account owner.
    const { data: account } = await admin
      .from('accounts').select('owner_user_id').eq('id', accountId).maybeSingle()
    if (account?.owner_user_id === targetUserId) {
      return { ok: false as const, error: 'O proprietário da conta não pode ser removido.' }
    }

    // Delete all memberships across the account's orgs + the account membership.
    const { data: orgRows } = await admin
      .from('organizations').select('id').eq('account_id', accountId)
    const orgIds = (orgRows ?? []).map(o => o.id)
    if (orgIds.length) {
      await admin.from('memberships').delete().in('organization_id', orgIds).eq('user_id', targetUserId)
    }
    await admin.from('account_members').delete().eq('account_id', accountId).eq('user_id', targetUserId)

    revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
    return { ok: true as const }
  }

  // Legacy org-level fallback (targetUserId here is treated as the user id).
  const { data: m } = await admin
    .from('memberships')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', targetUserId)
    .maybeSingle()
  if (m?.role === 'owner') {
    return { ok: false as const, error: 'O proprietário não pode ser removido.' }
  }
  const { error } = await admin
    .from('memberships')
    .delete()
    .eq('organization_id', org.id)
    .eq('user_id', targetUserId)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  return { ok: true as const }
}

// ── Cancel invitation ─────────────────────────────────────────────────────────

export async function cancelInvitation(orgSlug: string, invitationId: string) {
  const user = await requireAuth()
  const org   = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  const accountId = ((org as any).account_id as string | null) ?? null

  // The invite may be anchored to any org of the account — scope deletion to the account.
  if (accountId) {
    if (!(await isAccountManager(admin, accountId, user.id))) {
      return { ok: false as const, error: 'Apenas administradores da conta podem cancelar convites.' }
    }
    const { data: orgRows } = await admin
      .from('organizations').select('id').eq('account_id', accountId)
    const orgIds = (orgRows ?? []).map(o => o.id)
    const { error } = await admin
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .in('organization_id', orgIds.length ? orgIds : [org.id])
    if (error) return { ok: false as const, error: error.message }
  } else {
    const { error } = await admin
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .eq('organization_id', org.id)
    if (error) return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  return { ok: true as const }
}

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

  // Resolve the account of the origin org.
  const { data: originOrg } = await admin
    .from('organizations')
    .select('slug, account_id')
    .eq('id', inv.organization_id)
    .single()
  const accountId = (originOrg as any)?.account_id as string | null

  const accRole = inv.role === 'admin' ? 'admin' : 'member'
  const memberPerms = inv.role === 'admin' ? allPermissions() : (inv.permissions ?? defaultMemberPermissions())

  if (accountId) {
    // 1. Ensure account membership (the seat).
    await admin
      .from('account_members')
      .upsert(
        { account_id: accountId, user_id: user.id, role: accRole },
        { onConflict: 'account_id,user_id', ignoreDuplicates: true },
      )

    // 2. Fan out a membership into EVERY org of the account (present everywhere).
    const { data: orgRows } = await admin
      .from('organizations')
      .select('id')
      .eq('account_id', accountId)
    for (const o of orgRows ?? []) {
      await admin
        .from('memberships')
        .upsert(
          {
            organization_id: o.id,
            user_id:         user.id,
            role:            accRole,
            permissions:     memberPerms,
            hidden:          false,
          },
          { onConflict: 'organization_id,user_id', ignoreDuplicates: true },
        )
    }
  } else {
    // Legacy org without account: single membership.
    await admin
      .from('memberships')
      .upsert(
        { organization_id: inv.organization_id, user_id: user.id, role: inv.role, permissions: memberPerms },
        { onConflict: 'organization_id,user_id', ignoreDuplicates: true },
      )
  }

  // Mark invitation accepted.
  await admin.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('id', inv.id)

  return { ok: true as const, redirectTo: `/app/${originOrg?.slug}/pipeline` }
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
