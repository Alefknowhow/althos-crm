'use server'

/**
 * Team data types + the main team-page fetch (members, invitations,
 * orgs, seats). Split out of actions/team.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { type Permissions } from '@/lib/permissions'
import { getProfilesMap } from '@/lib/profiles'
import { isAccountManager } from './team-shared'

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
  current_org:  { membership_id: string; role: string; permissions: Permissions; monthly_goal_cents: number | null } | null
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

export async function getTeamData(orgSlug: string): Promise<TeamData> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  const accountId = ((org as any).account_id as string | null) ?? null

  // Legacy org without an account: fall back to single-org behaviour.
  if (!accountId) {
    const { data: memberships } = await admin
      .from('memberships')
      .select('id, user_id, role, permissions, created_at, hidden, monthly_goal_cents')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: true })

    const legacyProfiles = await getProfilesMap((memberships ?? []).map(m => m.user_id))
    const members: TeamMember[] = []
    for (const m of memberships ?? []) {
      const p = legacyProfiles.get(m.user_id)
      members.push({
        user_id:      m.user_id,
        email:        p?.email ?? '',
        name:         p?.full_name ?? '',
        account_role: m.role === 'member' ? 'member' : 'admin',
        is_owner:     m.role === 'owner',
        joined_at:    m.created_at,
        orgs:         [{ org_id: org.id, org_name: (org as any).name ?? orgSlug, membership_id: m.id, hidden: !!(m as any).hidden }],
        current_org:  { membership_id: m.id, role: m.role, permissions: (m.permissions ?? {}) as Permissions, monthly_goal_cents: (m as any).monthly_goal_cents ?? null },
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
    .select('id, organization_id, user_id, role, permissions, hidden, monthly_goal_cents')
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

  const acctProfiles = await getProfilesMap(Array.from(roleByUser.keys()))
  const members: TeamMember[] = []
  for (const userId of Array.from(roleByUser.keys())) {
    const p = acctProfiles.get(userId)
    const mine = (allMemberships ?? []).filter(m => m.user_id === userId)
    const cur = mine.find(m => m.organization_id === org.id)
    const accRole = roleByUser.get(userId) === 'admin' ? 'admin' : 'member'
    members.push({
      user_id:      userId,
      email:        p?.email ?? '',
      name:         p?.full_name ?? '',
      account_role: accRole,
      is_owner:     userId === ownerId,
      joined_at:    joinedByUser.get(userId) ?? new Date(0).toISOString(),
      orgs: orgs.map(o => {
        const mm = mine.find(m => m.organization_id === o.id)
        return { org_id: o.id, org_name: o.name, membership_id: mm?.id ?? null, hidden: !!mm?.hidden }
      }),
      current_org: cur
        ? { membership_id: cur.id, role: cur.role, permissions: (cur.permissions ?? {}) as Permissions, monthly_goal_cents: (cur as any).monthly_goal_cents ?? null }
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
