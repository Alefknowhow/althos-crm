'use server'

/**
 * Platform accounts overview (usage + plan) and plan updates. Split out
 * of actions/super-admin.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { AdminAccountRow } from './super-admin-users'

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function getPlatformAccounts(): Promise<AdminAccountRow[]> {
  if (!(await isSuperAdmin())) return []

  const admin = createAdminClient()
  const period = currentPeriod()

  const [acctRes, subsRes, orgsRes, creditsRes, membershipsRes, authRes] = await Promise.all([
    admin.from('accounts').select('id, name, owner_user_id, created_at'),
    admin.from('subscriptions').select('account_id, plan_id, status, billing_cycle, trial_ends_at'),
    admin.from('organizations').select('id, name, slug, account_id, plan, subscription_status, trial_ends_at, limit_leads, limit_users, limit_whatsapp_monthly, limit_email_monthly'),
    admin.from('ai_credits').select('account_id, credits_included, credits_used').eq('period_month', period),
    admin.from('memberships').select('user_id, organization_id'),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const orgs = (orgsRes.data ?? []) as any[]

  // 1 RPC agregada em vez de 1 count por org (achado 1.3 da auditoria de
  // performance) — não escala mais linearmente com o nº de contas na frota.
  const leadCountByOrg = new Map<string, number>()
  if (orgs.length > 0) {
    const { data: counts } = await admin.rpc('fleet_lead_and_member_counts', {
      p_org_ids: orgs.map(o => o.id),
    }) as { data: { organization_id: string; lead_count: number }[] | null }
    for (const c of counts ?? []) leadCountByOrg.set(c.organization_id, c.lead_count)
  }

  const orgToAccount = new Map<string, string>()
  const orgsByAccount = new Map<string, any[]>()
  for (const o of orgs) {
    if (!o.account_id) continue
    orgToAccount.set(o.id, o.account_id)
    const list = orgsByAccount.get(o.account_id) ?? []
    list.push(o)
    orgsByAccount.set(o.account_id, list)
  }

  const subByAccount = new Map<string, any>()
  for (const s of (subsRes.data ?? []) as any[]) subByAccount.set(s.account_id, s)

  const creditsByAccount = new Map<string, any>()
  for (const c of (creditsRes.data ?? []) as any[]) creditsByAccount.set(c.account_id, c)

  const membersByAccount = new Map<string, Set<string>>()
  for (const m of (membershipsRes.data ?? []) as any[]) {
    const acc = orgToAccount.get(m.organization_id)
    if (!acc) continue
    const set = membersByAccount.get(acc) ?? new Set<string>()
    set.add(m.user_id)
    membersByAccount.set(acc, set)
  }

  const userMap = new Map<string, any>()
  for (const u of (authRes.data?.users ?? []) as any[]) userMap.set(u.id, u)

  const rows: AdminAccountRow[] = (acctRes.data ?? []).map((a: any) => {
    const accOrgs = orgsByAccount.get(a.id) ?? []
    const sub     = subByAccount.get(a.id)
    const credits = creditsByAccount.get(a.id)
    const owner   = a.owner_user_id ? userMap.get(a.owner_user_id) : null
    const primary = accOrgs[0] ?? null
    const lead_count = accOrgs.reduce((s: number, o: any) => s + (leadCountByOrg.get(o.id) ?? 0), 0)
    return {
      account_id:             a.id,
      account_name:           a.name,
      owner_user_id:          a.owner_user_id ?? null,
      owner_email:            owner?.email ?? null,
      owner_name:             owner?.user_metadata?.full_name ?? owner?.user_metadata?.name ?? null,
      owner_is_super_admin:   owner?.app_metadata?.is_super_admin === true,
      owner_last_sign_in_at:  owner?.last_sign_in_at ?? null,
      created_at:             a.created_at,
      plan:                   sub?.plan_id ?? primary?.plan ?? 'free',
      subscription_status:    sub?.status ?? primary?.subscription_status ?? 'no_billing',
      billing_cycle:          sub?.billing_cycle ?? null,
      trial_ends_at:          sub?.trial_ends_at ?? primary?.trial_ends_at ?? null,
      org_count:              accOrgs.length,
      lead_count,
      member_count:           membersByAccount.get(a.id)?.size ?? 0,
      ai_credits_included:    credits?.credits_included ?? 0,
      ai_credits_used:        credits?.credits_used ?? 0,
      limit_leads:            primary?.limit_leads ?? null,
      limit_users:            primary?.limit_users ?? null,
      limit_whatsapp_monthly: primary?.limit_whatsapp_monthly ?? null,
      limit_email_monthly:    primary?.limit_email_monthly ?? null,
      orgs: accOrgs.map((o: any) => ({ id: o.id, name: o.name, slug: o.slug, lead_count: leadCountByOrg.get(o.id) ?? 0 })),
    }
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return rows
}

const updateAccountPlanSchema = z.object({
  plan:                   z.string().min(1),
  subscription_status:    z.enum(['trialing', 'active', 'past_due', 'canceled', 'no_billing']),
  billing_cycle:          z.enum(['monthly', 'semestral', 'annual']).nullable().optional(),
  limit_leads:            z.coerce.number().int().min(0).nullable(),
  limit_users:            z.coerce.number().int().min(1).nullable(),
  limit_whatsapp_monthly: z.coerce.number().int().min(0).nullable(),
  limit_email_monthly:    z.coerce.number().int().min(0).nullable(),
})

export type UpdateAccountPlanInput = z.infer<typeof updateAccountPlanSchema>

export async function updateAccountPlan(accountId: string, raw: unknown, reason: string) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  if (!reason || !reason.trim()) return { ok: false as const, error: 'Informe o motivo da alteração.' }

  const parsed = updateAccountPlanSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }
  const d = parsed.data

  const me = await getUser()
  if (!me) return { ok: false as const, error: 'Não autenticado' }

  const admin = createAdminClient()

  // RPC transacional (0266): subscriptions + organizations (fan-out pra
  // toda a conta) + ai_credits + o log de auditoria acontecem na MESMA
  // transação — se qualquer passo falhar (inclusive o insert de
  // auditoria), tudo é revertido. Antes eram writes separados via
  // PostgREST; um erro no log de auditoria deixava a mutação já commitada
  // mas reportava falha pro admin (achado da revisão automática da PR #38).
  const { error } = await admin.rpc('admin_update_account_plan', {
    p_account_id: accountId,
    p_plan_id: d.plan,
    p_status: d.subscription_status,
    p_billing_cycle: d.billing_cycle ?? 'monthly',
    p_limit_leads: d.limit_leads,
    p_limit_users: d.limit_users,
    p_limit_whatsapp: d.limit_whatsapp_monthly,
    p_limit_email: d.limit_email_monthly,
    p_actor_id: me.id,
    p_reason: reason,
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/super-admin/users')
  revalidatePath('/super-admin')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Referrals dashboard
// ---------------------------------------------------------------------------

export type ReferralRow = {
  id:            string
  referrer_name: string
  referred_name: string | null
  referral_code: string
  status:        string
  reward_type:   string | null
  reward_value:  number | null
  created_at:    string
  converted_at:  string | null
  rewarded_at:   string | null
}

export type ReferralsOverview = {
  total:        number
  pending:      number
  converted:    number
  rewarded:     number
  topReferrers: { account_id: string; name: string; code: string; count: number }[]
  rows:         ReferralRow[]
}

