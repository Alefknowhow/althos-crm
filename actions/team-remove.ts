'use server'

/**
 * Removing a member, cancelling a pending invitation, and re-sending
 * (fan-out) an invitation email. Split out of actions/team.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { allPermissions, defaultMemberPermissions, type Permissions } from '@/lib/permissions'
import { isAccountManager } from './team-shared'

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

// ── Shared: materialize memberships for an accepted invitation ─────────────────
/**
 * Joins `userId` to the account/orgs described by `inv` and marks the invite
 * accepted. Shared by both the logged-in accept flow and the new-invitee
 * signup flow. Returns the slug of the origin org for redirect.
 */
export async function fanOutInvitation(
  admin: ReturnType<typeof createAdminClient>,
  inv: { id: string; organization_id: string; role: string; permissions: Permissions | null },
  userId: string,
): Promise<string | null> {
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
        { account_id: accountId, user_id: userId, role: accRole },
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
            user_id:         userId,
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
        { organization_id: inv.organization_id, user_id: userId, role: inv.role, permissions: memberPerms },
        { onConflict: 'organization_id,user_id', ignoreDuplicates: true },
      )
  }

  // Mark invitation accepted.
  await admin.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('id', inv.id)

  return (originOrg as any)?.slug ?? null
}
