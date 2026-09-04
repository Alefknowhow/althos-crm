'use server'

/**
 * Super-admin impersonation and global/executive metrics.
 * Split out of actions/super-admin.ts.
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function impersonateOrganization(orgId: string) {
  const superAdmin = await isSuperAdmin()
  if (!superAdmin) return { ok: false as const, error: 'Não autorizado' }

  const supabase = createClient()
  const user = await getUser()

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()

  if (!org) return { ok: false as const, error: 'Organização não encontrada' }

  await supabase.from('super_admin_audit_log').insert({
    super_admin_user_id: user?.id,
    action: 'impersonate_start',
    target_organization_id: orgId,
  })

  cookies().set('impersonated_org_id', orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 h
  })

  redirect(`/app/${org.slug}`)
}

export async function exitImpersonation() {
  const supabase = createClient()
  const user = await getUser()
  const impersonatedOrgId = cookies().get('impersonated_org_id')?.value

  if (impersonatedOrgId) {
    await supabase.from('super_admin_audit_log').insert({
      super_admin_user_id: user?.id,
      action: 'impersonate_end',
      target_organization_id: impersonatedOrgId,
    })
  }

  cookies().delete('impersonated_org_id')
  redirect('/super-admin')
}

// ---------------------------------------------------------------------------
// Global metrics
// ---------------------------------------------------------------------------

export type GlobalMetrics = {
  totalOrgs:        number
  activeOrgs:       number   // subscription_status = 'active'
  trialOrgs:        number
  totalLeads:       number
  totalUsers:       number   // distinct user_ids across all memberships
  newOrgsLast30:    number
}

export async function getGlobalMetrics(): Promise<GlobalMetrics> {
  if (!(await isSuperAdmin())) {
    return { totalOrgs: 0, activeOrgs: 0, trialOrgs: 0, totalLeads: 0, totalUsers: 0, newOrgsLast30: 0 }
  }

  const admin = createAdminClient()
  const ago30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [orgsRes, leadsRes, usersRes, newOrgsRes] = await Promise.all([
    admin.from('organizations').select('id, subscription_status'),
    admin.from('contatos').select('id', { count: 'exact', head: true }),
    admin.from('memberships').select('user_id'),
    admin.from('organizations').select('id', { count: 'exact', head: true }).gte('created_at', ago30),
  ])

  const orgs = orgsRes.data || []
  const uniqueUsers = new Set((usersRes.data || []).map((m: any) => m.user_id))

  return {
    totalOrgs:     orgs.length,
    activeOrgs:    orgs.filter((o: any) => o.subscription_status === 'active').length,
    trialOrgs:     orgs.filter((o: any) => o.subscription_status === 'trialing' || o.subscription_status === 'no_billing').length,
    totalLeads:    leadsRes.count ?? 0,
    totalUsers:    uniqueUsers.size,
    newOrgsLast30: newOrgsRes.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Executive dashboard metrics (reads materialized view admin_dashboard_metrics)
// ---------------------------------------------------------------------------

export type ExecutiveMetrics = {
  totalAccounts:      number
  totalOrgs:          number
  activeOrgs:         number
  trialOrgs:          number
  totalUsers:         number
  totalLeads:         number
  payingAccounts:     number
  mrrCents:           number
  arrCents:           number
  signups7d:          number
  signups30d:         number
  aiCreditsUsedMonth: number
  openCriticalAlerts: number
  computedAt:         string | null
  planDistribution:   { plan: string; count: number }[]
}

const EMPTY_EXEC: ExecutiveMetrics = {
  totalAccounts: 0, totalOrgs: 0, activeOrgs: 0, trialOrgs: 0, totalUsers: 0,
  totalLeads: 0, payingAccounts: 0, mrrCents: 0, arrCents: 0, signups7d: 0,
  signups30d: 0, aiCreditsUsedMonth: 0, openCriticalAlerts: 0, computedAt: null,
  planDistribution: [],
}

export async function getExecutiveMetrics(): Promise<ExecutiveMetrics> {
  if (!(await isSuperAdmin())) return EMPTY_EXEC

  const admin = createAdminClient()

  // Refresh the summary view so numbers are current (cheap; single-row aggregate).
  await admin.rpc('refresh_admin_dashboard_metrics').then(
    () => {},
    () => {}, // function may not exist yet on older DBs — ignore, read stale view
  )

  const [metricsRes, subsRes] = await Promise.all([
    admin.from('admin_dashboard_metrics').select('*').single(),
    admin.from('subscriptions').select('plan_id, status'),
  ])

  const m = metricsRes.data as any
  if (!m) return EMPTY_EXEC

  // Plan distribution among active/trialing subscriptions.
  const counts = new Map<string, number>()
  for (const s of (subsRes.data ?? []) as any[]) {
    if (s.status !== 'active' && s.status !== 'trialing') continue
    counts.set(s.plan_id, (counts.get(s.plan_id) ?? 0) + 1)
  }
  const order = ['free', 'starter', 'pro', 'business']
  const planDistribution = Array.from(counts.entries())
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => order.indexOf(a.plan) - order.indexOf(b.plan))

  return {
    totalAccounts:      m.total_accounts ?? 0,
    totalOrgs:          m.total_orgs ?? 0,
    activeOrgs:         m.active_orgs ?? 0,
    trialOrgs:          m.trial_orgs ?? 0,
    totalUsers:         m.total_users ?? 0,
    totalLeads:         m.total_leads ?? 0,
    payingAccounts:     m.paying_accounts ?? 0,
    mrrCents:           Number(m.mrr_cents ?? 0),
    arrCents:           Number(m.arr_cents ?? 0),
    signups7d:          m.signups_7d ?? 0,
    signups30d:         m.signups_30d ?? 0,
    aiCreditsUsedMonth: m.ai_credits_used_month ?? 0,
    openCriticalAlerts: m.open_critical_alerts ?? 0,
    computedAt:         m.computed_at ?? null,
    planDistribution,
  }
}

// ---------------------------------------------------------------------------
// Organizations list
// ---------------------------------------------------------------------------

export type SuperAdminOrg = {
  id:                  string
  name:                string
  slug:                string
  plan:                string
  account_type:        string
  subscription_status: string
  created_at:          string
  trial_ends_at:       string | null
  limit_leads:         number | null
  limit_whatsapp_monthly: number | null
  limit_email_monthly: number | null
  limit_users:         number | null
  notes:               string | null
  leadCount:           number
  memberCount:         number
  // Onboarding wizard fields
  onboarding_completed: boolean
  contact_email:        string | null
  contact_phone:        string | null
  niche:                string | null
  address_city:         string | null
  address_state:        string | null
  address_zip:          string | null
}

