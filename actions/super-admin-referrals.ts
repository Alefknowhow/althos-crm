'use server'

/**
 * Referral program overview + status updates, and system config.
 * Split out of actions/super-admin.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import type { ReferralsOverview, ReferralRow } from './super-admin-accounts'

export async function getReferralsOverview(): Promise<ReferralsOverview> {
  const empty: ReferralsOverview = { total: 0, pending: 0, converted: 0, rewarded: 0, topReferrers: [], rows: [] }
  if (!(await isSuperAdmin())) return empty

  const admin = createAdminClient()
  const { data: refs } = await admin
    .from('referrals')
    .select('id, referrer_account_id, referred_account_id, referral_code, status, reward_type, reward_value, created_at, converted_at, rewarded_at')
    .order('created_at', { ascending: false })

  if (!refs || refs.length === 0) return empty

  // Resolve account names
  const acctIds = Array.from(new Set(
    refs.flatMap((r: any) => [r.referrer_account_id, r.referred_account_id]).filter(Boolean),
  ))
  const { data: accts } = await admin.from('accounts').select('id, name, referral_code').in('id', acctIds)
  const nameMap = new Map<string, string>((accts ?? []).map((a: any) => [a.id, a.name]))

  const rows: ReferralRow[] = refs.map((r: any) => ({
    id:            r.id,
    referrer_name: nameMap.get(r.referrer_account_id) ?? '—',
    referred_name: r.referred_account_id ? (nameMap.get(r.referred_account_id) ?? '—') : null,
    referral_code: r.referral_code,
    status:        r.status,
    reward_type:   r.reward_type,
    reward_value:  r.reward_value,
    created_at:    r.created_at,
    converted_at:  r.converted_at,
    rewarded_at:   r.rewarded_at,
  }))

  // Top referrers
  const counts = new Map<string, number>()
  for (const r of refs as any[]) counts.set(r.referrer_account_id, (counts.get(r.referrer_account_id) ?? 0) + 1)
  const codeMap = new Map<string, string>((accts ?? []).map((a: any) => [a.id, a.referral_code]))
  const topReferrers = Array.from(counts.entries())
    .map(([account_id, count]) => ({ account_id, name: nameMap.get(account_id) ?? '—', code: codeMap.get(account_id) ?? '', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    total:     refs.length,
    pending:   refs.filter((r: any) => r.status === 'pending').length,
    converted: refs.filter((r: any) => r.status === 'converted').length,
    rewarded:  refs.filter((r: any) => r.status === 'rewarded').length,
    topReferrers,
    rows,
  }
}

export async function updateReferralStatus(referralId: string, status: 'converted' | 'rewarded') {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const admin = createAdminClient()
  const patch: Record<string, any> = { status }
  if (status === 'converted') patch.converted_at = new Date().toISOString()
  if (status === 'rewarded')  patch.rewarded_at  = new Date().toISOString()

  const { error } = await admin.from('referrals').update(patch).eq('id', referralId)
  if (error) return { ok: false as const, error: error.message }

  const me = await getUser()
  await admin.from('super_admin_audit_log').insert({
    super_admin_user_id:    me?.id,
    action:                 'referral_' + status + ':' + referralId,
    target_organization_id: null,
  })

  revalidatePath('/super-admin/referrals')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// System configuration
// ---------------------------------------------------------------------------

export type SystemConfigRow = {
  key:         string
  value:       any
  description: string | null
  updated_at:  string | null
}

export async function getSystemConfig(): Promise<SystemConfigRow[]> {
  if (!(await isSuperAdmin())) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('system_config')
    .select('key, value, description, updated_at')
    .order('key', { ascending: true })
  return (data ?? []) as SystemConfigRow[]
}

export async function updateSystemConfig(key: string, rawValue: string) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  let parsedValue: any
  try {
    parsedValue = JSON.parse(rawValue)
  } catch {
    return { ok: false as const, error: 'Valor inválido — informe um JSON válido (ex: true, 100, "texto").' }
  }

  const admin = createAdminClient()
  const me = await getUser()
  const { error } = await admin
    .from('system_config')
    .update({ value: parsedValue, updated_at: new Date().toISOString(), updated_by: me?.id ?? null })
    .eq('key', key)

  if (error) return { ok: false as const, error: error.message }

  await admin.from('super_admin_audit_log').insert({
    super_admin_user_id:    me?.id,
    action:                 'update_config:' + key,
    target_organization_id: null,
  })

  revalidatePath('/super-admin/settings')
  return { ok: true as const }
}
