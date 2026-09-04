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

  // Lead counts per org (small N — handful of orgs).
  const leadCountByOrg = new Map<string, number>()
  await Promise.all(orgs.map(async (o) => {
    const { count } = await admin.from('contatos').select('id', { count: 'exact', head: true }).eq('organization_id', o.id)
    leadCountByOrg.set(o.id, count ?? 0)
  }))

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

export async function updateAccountPlan(accountId: string, raw: unknown) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const parsed = updateAccountPlanSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }
  const d = parsed.data

  const admin = createAdminClient()

  // Plan catalog → créditos de IA inclusos no período.
  const { data: planRow } = await admin
    .from('plans')
    .select('ai_credits_monthly')
    .eq('id', d.plan)
    .maybeSingle()
  const aiCredits = (planRow as any)?.ai_credits_monthly ?? 0

  // 1. Assinatura da conta (1 por conta — unique account_id).
  const { error: subErr } = await admin
    .from('subscriptions')
    .upsert(
      {
        account_id:    accountId,
        plan_id:       d.plan,
        status:        d.subscription_status,
        billing_cycle: d.billing_cycle ?? 'monthly',
      },
      { onConflict: 'account_id' },
    )
  if (subErr) return { ok: false as const, error: subErr.message }

  // 2. Fan-out para todas as organizações da conta (mantém gating consistente).
  const { error: orgErr } = await admin
    .from('organizations')
    .update({
      plan:                   d.plan,
      subscription_status:    d.subscription_status,
      limit_leads:            d.limit_leads,
      limit_users:            d.limit_users,
      limit_whatsapp_monthly: d.limit_whatsapp_monthly,
      limit_email_monthly:    d.limit_email_monthly,
    })
    .eq('account_id', accountId)
  if (orgErr) return { ok: false as const, error: orgErr.message }

  // 3. Créditos de IA do período atual (sincronizados com o catálogo do plano).
  const period = currentPeriod()
  const { data: existingCredits } = await admin
    .from('ai_credits')
    .select('id')
    .eq('account_id', accountId)
    .eq('period_month', period)
    .maybeSingle()
  if (existingCredits) {
    await admin.from('ai_credits').update({ credits_included: aiCredits }).eq('id', (existingCredits as any).id)
  } else {
    await admin.from('ai_credits').insert({
      account_id:        accountId,
      period_month:      period,
      credits_included:  aiCredits,
      credits_purchased: 0,
      credits_used:      0,
    })
  }

  const me = await getUser()
  await admin.from('super_admin_audit_log').insert({
    super_admin_user_id:    me?.id,
    action:                 'update_account_plan:' + d.plan,
    target_organization_id: null,
  })

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

