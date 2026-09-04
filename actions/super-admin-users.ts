'use server'

/**
 * Platform user listing and super-admin flag toggling. Split out of
 * actions/super-admin.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import type { PlatformUser, PlatformUserAccount } from './super-admin-managed-org'

export async function getPlatformUsers(): Promise<PlatformUser[]> {
  if (!(await isSuperAdmin())) return []

  const admin = createAdminClient()

  const [{ data: authData }, acctMembersRes, membershipsRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('account_members').select('user_id, role, account_id, accounts(name)'),
    admin.from('memberships').select('user_id'),
  ])

  // user_id -> accounts[]
  const acctMap = new Map<string, PlatformUserAccount[]>()
  for (const m of (acctMembersRes.data ?? []) as any[]) {
    const list = acctMap.get(m.user_id) ?? []
    list.push({ id: m.account_id, name: m.accounts?.name ?? '—', role: m.role })
    acctMap.set(m.user_id, list)
  }

  // user_id -> org count
  const orgCount = new Map<string, number>()
  for (const m of (membershipsRes.data ?? []) as any[]) {
    orgCount.set(m.user_id, (orgCount.get(m.user_id) ?? 0) + 1)
  }

  return (authData?.users ?? [])
    .map((u: any) => ({
      id:              u.id,
      email:           u.email ?? null,
      full_name:       u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
      created_at:      u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      is_super_admin:  u.app_metadata?.is_super_admin === true,
      accounts:        acctMap.get(u.id) ?? [],
      org_count:       orgCount.get(u.id) ?? 0,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function setUserSuperAdmin(userId: string, value: boolean) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const me = await getUser()
  if (me?.id === userId && value === false) {
    return { ok: false as const, error: 'Você não pode remover seu próprio acesso de super admin.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { is_super_admin: value },
  })
  if (error) return { ok: false as const, error: error.message }

  await admin.from('super_admin_audit_log').insert({
    super_admin_user_id:    me?.id,
    action:                 value ? 'grant_super_admin:' + userId : 'revoke_super_admin:' + userId,
    target_organization_id: null,
  })

  revalidatePath('/super-admin/users')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Account-centric control (plan / limits / usage by OWNER account)
//
// O controle de plano e limites passa a ser por Conta (cada Conta tem um dono).
// Ao salvar, fazemos fan-out para todas as organizações da conta + upsert da
// assinatura + créditos de IA do período, mantendo o gating existente (que lê
// organizations.plan / limit_*) consistente.
// ---------------------------------------------------------------------------

export type AdminAccountOrg = { id: string; name: string; slug: string; lead_count: number }

export type AdminAccountRow = {
  account_id:             string
  account_name:           string
  owner_user_id:          string | null
  owner_email:            string | null
  owner_name:             string | null
  owner_is_super_admin:   boolean
  owner_last_sign_in_at:  string | null
  created_at:             string
  plan:                   string
  subscription_status:    string
  billing_cycle:          string | null
  trial_ends_at:          string | null
  org_count:              number
  lead_count:             number
  member_count:           number
  ai_credits_included:    number
  ai_credits_used:        number
  limit_leads:            number | null
  limit_users:            number | null
  limit_whatsapp_monthly: number | null
  limit_email_monthly:    number | null
  orgs:                   AdminAccountOrg[]
}

