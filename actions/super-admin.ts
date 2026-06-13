'use server'

import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getProfilesMap } from '@/lib/profiles'
import { resend, EMAIL_FROM } from '@/lib/resend'
import { slugify } from '@/lib/utils'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

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

export async function getAllOrganizations(): Promise<SuperAdminOrg[]> {
  if (!(await isSuperAdmin())) return []

  const admin = createAdminClient()

  const { data: orgs } = await admin
    .from('organizations')
    .select(`
      id, name, slug, plan, account_type, subscription_status,
      created_at, trial_ends_at,
      limit_leads, limit_whatsapp_monthly, limit_email_monthly, limit_users,
      notes,
      onboarding_completed, contact_email, contact_phone,
      niche, address_city, address_state, address_zip
    `)
    .order('created_at', { ascending: false })

  if (!orgs) return []

  // Fetch lead counts + member counts in parallel per org
  const withStats = await Promise.all(orgs.map(async (org) => {
    const [leadsRes, membersRes] = await Promise.all([
      admin.from('contatos').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
      admin.from('memberships').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
    ])
    return {
      ...org,
      leadCount:   leadsRes.count ?? 0,
      memberCount: membersRes.count ?? 0,
    }
  }))

  return withStats
}

// ---------------------------------------------------------------------------
// Update org limits / plan
// ---------------------------------------------------------------------------

const updateOrgLimitsSchema = z.object({
  plan:                   z.string().min(1),
  subscription_status:    z.enum(['trialing', 'active', 'past_due', 'canceled', 'no_billing']),
  limit_leads:            z.coerce.number().int().min(0).nullable(),
  limit_whatsapp_monthly: z.coerce.number().int().min(0).nullable(),
  limit_email_monthly:    z.coerce.number().int().min(0).nullable(),
  limit_users:            z.coerce.number().int().min(1).nullable(),
  notes:                  z.string().max(1000).optional().nullable(),
})

export type UpdateOrgLimitsInput = z.infer<typeof updateOrgLimitsSchema>

export async function updateOrgLimits(orgId: string, raw: unknown) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const parsed = updateOrgLimitsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const admin = createAdminClient()

  const { error } = await admin
    .from('organizations')
    .update({
      plan:                   parsed.data.plan,
      subscription_status:    parsed.data.subscription_status,
      limit_leads:            parsed.data.limit_leads,
      limit_whatsapp_monthly: parsed.data.limit_whatsapp_monthly,
      limit_email_monthly:    parsed.data.limit_email_monthly,
      limit_users:            parsed.data.limit_users,
      notes:                  parsed.data.notes ?? null,
    })
    .eq('id', orgId)

  if (error) return { ok: false as const, error: error.message }

  // Audit log
  const supabase = createClient()
  const user = await getUser()
  await supabase.from('super_admin_audit_log').insert({
    super_admin_user_id: user?.id,
    action:                 'update_limits',
    target_organization_id: orgId,
  })

  revalidatePath('/super-admin')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditLogEntry = {
  id:                     string
  action:                 string
  created_at:             string
  super_admin_user_id:    string
  super_admin_email:      string | null
  target_organization_id: string
  org_name:               string | null
  org_slug:               string | null
}

export async function getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  if (!(await isSuperAdmin())) return []

  const admin = createAdminClient()

  const { data: logs } = await admin
    .from('super_admin_audit_log')
    .select(`
      id, action, created_at, super_admin_user_id, target_organization_id,
      organizations ( name, slug )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!logs) return []

  // Resolve super admin emails via the profiles mirror (one batched query).
  const uniqueAdminIds = Array.from(new Set(logs.map((l: any) => l.super_admin_user_id)))
  const profiles = await getProfilesMap(uniqueAdminIds)
  const emailMap = new Map<string, string>()
  for (const uid of uniqueAdminIds) {
    const email = profiles.get(uid)?.email
    if (email) emailMap.set(uid, email)
  }

  return logs.map((log: any) => ({
    id:                     log.id,
    action:                 log.action,
    created_at:             log.created_at,
    super_admin_user_id:    log.super_admin_user_id,
    super_admin_email:      emailMap.get(log.super_admin_user_id) ?? null,
    target_organization_id: log.target_organization_id,
    org_name:               log.organizations?.name ?? null,
    org_slug:               log.organizations?.slug ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Plans & coupons management
// ---------------------------------------------------------------------------

export type AdminPlan = {
  id:                  string
  name:                string
  price_monthly_cents: number
  price_annual_cents:  number
  ai_credits_monthly:  number
  max_leads_per_month: number
  max_users:           number
  is_active:           boolean
  active_subscriptions:number
}

export type AdminCoupon = {
  id:              string
  code:            string
  description:     string | null
  discount_type:   string
  discount_value:  number
  applies_to_plan: string | null
  max_uses:        number
  uses_count:      number
  duration_months: number
  expires_at:      string | null
  is_active:       boolean
  created_at:      string
}

export async function getBillingCatalog(): Promise<{ plans: AdminPlan[]; coupons: AdminCoupon[] }> {
  if (!(await isSuperAdmin())) return { plans: [], coupons: [] }

  const admin = createAdminClient()
  const [plansRes, couponsRes, subsRes] = await Promise.all([
    admin.from('plans').select('id, name, price_monthly_cents, price_annual_cents, ai_credits_monthly, max_leads_per_month, max_users, is_active'),
    admin.from('coupons').select('*').order('created_at', { ascending: false }),
    admin.from('subscriptions').select('plan_id, status'),
  ])

  const subCounts = new Map<string, number>()
  for (const s of (subsRes.data ?? []) as any[]) {
    if (s.status === 'active' || s.status === 'trialing') {
      subCounts.set(s.plan_id, (subCounts.get(s.plan_id) ?? 0) + 1)
    }
  }

  const order = ['free', 'starter', 'pro', 'business']
  const plans: AdminPlan[] = (plansRes.data ?? [])
    .map((p: any) => ({ ...p, active_subscriptions: subCounts.get(p.id) ?? 0 }))
    .sort((a: any, b: any) => order.indexOf(a.id) - order.indexOf(b.id))

  return { plans, coupons: (couponsRes.data ?? []) as AdminCoupon[] }
}

const updatePlanSchema = z.object({
  price_monthly_cents: z.coerce.number().int().min(0),
  price_annual_cents:  z.coerce.number().int().min(0),
  ai_credits_monthly:  z.coerce.number().int().min(0),
  // -1 = ilimitado (convenção da tabela plans)
  max_leads_per_month: z.coerce.number().int().min(-1),
  max_users:           z.coerce.number().int().min(-1),
  is_active:           z.coerce.boolean(),
})

export async function updatePlanPricing(planId: string, raw: unknown) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  const parsed = updatePlanSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const admin = createAdminClient()
  const { error } = await admin.from('plans').update(parsed.data).eq('id', planId)
  if (error) return { ok: false as const, error: error.message }

  const user = await getUser()
  await admin.from('super_admin_audit_log').insert({
    super_admin_user_id: user?.id,
    action:              'update_plan:' + planId,
    target_organization_id: null,
  })

  revalidatePath('/super-admin/plans')
  return { ok: true as const }
}

const createCouponSchema = z.object({
  code:            z.string().min(2).max(40).transform(s => s.toUpperCase().trim()),
  description:     z.string().max(200).optional().nullable(),
  discount_type:   z.enum(['percent', 'fixed_cents']),
  discount_value:  z.coerce.number().int().min(1),
  applies_to_plan: z.string().optional().nullable(),
  max_uses:        z.coerce.number().int(),
  duration_months: z.coerce.number().int().min(1),
  expires_at:      z.string().optional().nullable(),
})

export async function createCoupon(raw: unknown) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  const parsed = createCouponSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const admin = createAdminClient()
  const d = parsed.data
  const { error } = await admin.from('coupons').insert({
    code:            d.code,
    description:     d.description || null,
    discount_type:   d.discount_type,
    discount_value:  d.discount_value,
    applies_to_plan: d.applies_to_plan || null,
    max_uses:        d.max_uses,
    duration_months: d.duration_months,
    expires_at:      d.expires_at || null,
    is_active:       true,
  })
  if (error) {
    if (error.code === '23505') return { ok: false as const, error: 'Já existe um cupom com esse código' }
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/super-admin/plans')
  return { ok: true as const }
}

export async function setCouponActive(couponId: string, active: boolean) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  const admin = createAdminClient()
  const { error } = await admin.from('coupons').update({ is_active: active }).eq('id', couponId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/super-admin/plans')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// AI credits — consumption dashboards
// ---------------------------------------------------------------------------

export type AiCreditsAccountRow = {
  account_id: string
  name:       string
  plan:       string
  included:   number
  purchased:  number
  used:       number
  remaining:  number
}

export type AiCreditsOverview = {
  period:        string            // 'YYYY-MM'
  totalIncluded: number
  totalPurchased:number
  totalUsed:     number
  byAction:      { action: string; used: number }[]
  accounts:      AiCreditsAccountRow[]
}

export async function getAiCreditsOverview(period?: string): Promise<AiCreditsOverview> {
  const now = new Date()
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const p = period && /^\d{4}-\d{2}$/.test(period) ? period : fallback

  if (!(await isSuperAdmin())) {
    return { period: p, totalIncluded: 0, totalPurchased: 0, totalUsed: 0, byAction: [], accounts: [] }
  }

  const admin = createAdminClient()

  const [creditsRes, txRes, accountsRes, subsRes] = await Promise.all([
    admin.from('ai_credits').select('account_id, credits_included, credits_purchased, credits_used').eq('period_month', p),
    admin.from('ai_credit_transactions').select('action, credits_delta, created_at, type'),
    admin.from('accounts').select('id, name'),
    admin.from('subscriptions').select('account_id, plan_id, status'),
  ])

  const nameMap = new Map((accountsRes.data ?? []).map((a: any) => [a.id, a.name]))
  const planMap = new Map<string, string>()
  for (const s of (subsRes.data ?? []) as any[]) {
    if (s.status === 'active' || s.status === 'trialing') planMap.set(s.account_id, s.plan_id)
  }

  // Per-account balances for the period.
  const accounts: AiCreditsAccountRow[] = (creditsRes.data ?? [])
    .map((c: any) => ({
      account_id: c.account_id,
      name:       nameMap.get(c.account_id) ?? '—',
      plan:       planMap.get(c.account_id) ?? 'free',
      included:   c.credits_included ?? 0,
      purchased:  c.credits_purchased ?? 0,
      used:       c.credits_used ?? 0,
      remaining:  (c.credits_included ?? 0) + (c.credits_purchased ?? 0) - (c.credits_used ?? 0),
    }))
    .sort((a, b) => b.used - a.used)

  const totalIncluded  = accounts.reduce((s, a) => s + a.included, 0)
  const totalPurchased = accounts.reduce((s, a) => s + a.purchased, 0)
  const totalUsed      = accounts.reduce((s, a) => s + a.used, 0)

  // Consumption by action — only "consumed" transactions inside the period.
  const actionMap = new Map<string, number>()
  for (const t of (txRes.data ?? []) as any[]) {
    if (t.type !== 'consumed') continue
    if (!t.created_at || t.created_at.slice(0, 7) !== p) continue
    actionMap.set(t.action, (actionMap.get(t.action) ?? 0) + Math.abs(t.credits_delta ?? 0))
  }
  const byAction = Array.from(actionMap.entries())
    .map(([action, used]) => ({ action, used }))
    .sort((a, b) => b.used - a.used)

  return { period: p, totalIncluded, totalPurchased, totalUsed, byAction, accounts }
}

// ---------------------------------------------------------------------------
// System alerts
// ---------------------------------------------------------------------------

export type SystemAlert = {
  id:           string
  severity:     'info' | 'warning' | 'critical'
  type:         string
  title:        string
  message:      string | null
  status:       'open' | 'acknowledged' | 'resolved'
  metadata:     Record<string, any>
  org_name:     string | null
  org_slug:     string | null
  created_at:   string
  resolved_at:  string | null
}

export type AlertCounts = { open: number; critical: number; warning: number }

export async function getSystemAlerts(
  filter: 'open' | 'all' = 'open',
  limit = 200,
): Promise<{ alerts: SystemAlert[]; counts: AlertCounts }> {
  if (!(await isSuperAdmin())) return { alerts: [], counts: { open: 0, critical: 0, warning: 0 } }

  const admin = createAdminClient()

  let query = admin
    .from('system_alerts')
    .select('id, severity, type, title, message, status, metadata, created_at, resolved_at, organizations(name, slug)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filter === 'open') query = query.in('status', ['open', 'acknowledged'])

  const [{ data }, openRes, critRes, warnRes] = await Promise.all([
    query,
    admin.from('system_alerts').select('id', { count: 'exact', head: true }).in('status', ['open', 'acknowledged']),
    admin.from('system_alerts').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'critical'),
    admin.from('system_alerts').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'warning'),
  ])

  const alerts: SystemAlert[] = (data ?? []).map((a: any) => ({
    id:          a.id,
    severity:    a.severity,
    type:        a.type,
    title:       a.title,
    message:     a.message,
    status:      a.status,
    metadata:    a.metadata ?? {},
    org_name:    a.organizations?.name ?? null,
    org_slug:    a.organizations?.slug ?? null,
    created_at:  a.created_at,
    resolved_at: a.resolved_at,
  }))

  return {
    alerts,
    counts: { open: openRes.count ?? 0, critical: critRes.count ?? 0, warning: warnRes.count ?? 0 },
  }
}

export async function getOpenAlertCount(): Promise<number> {
  if (!(await isSuperAdmin())) return 0
  const admin = createAdminClient()
  const { count } = await admin
    .from('system_alerts')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'acknowledged'])
  return count ?? 0
}

export async function updateAlertStatus(
  alertId: string,
  status: 'acknowledged' | 'resolved',
) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const admin = createAdminClient()
  const user = await getUser()

  const patch: Record<string, any> = { status }
  if (status === 'acknowledged') patch.acknowledged_at = new Date().toISOString()
  if (status === 'resolved') {
    patch.resolved_at = new Date().toISOString()
    patch.resolved_by = user?.id ?? null
  }

  const { error } = await admin.from('system_alerts').update(patch).eq('id', alertId)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/super-admin/alertas')
  revalidatePath('/super-admin')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Activate managed org
// ---------------------------------------------------------------------------

export async function activateManagedOrganization(formData: FormData) {
  const superAdmin = await isSuperAdmin()
  if (!superAdmin) return { ok: false as const, error: 'Não autorizado' }

  const name  = formData.get('name')  as string
  const email = formData.get('email') as string
  const tier  = formData.get('tier')  as string
  const notes = formData.get('notes') as string

  if (!name || !email || !tier) return { ok: false as const, error: 'Campos obrigatórios faltando' }

  const adminSupabase = createAdminClient()
  const slug = slugify(name) + '-' + Math.random().toString(36).substring(2, 6)

  const password = Math.random().toString(36).substring(2, 15)
  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (authError) return { ok: false as const, error: 'Erro ao criar usuário: ' + authError.message }

  const { data: org, error: orgError } = await adminSupabase.rpc('create_organization_for_user_manual', {
    org_name:  name,
    org_slug:  slug,
    owner_id:  authUser.user.id,
    acc_type:  'althos_managed',
    tier_plan: tier,
  })

  if (orgError) return { ok: false as const, error: 'Erro ao criar organização: ' + orgError.message }

  await adminSupabase
    .from('organizations')
    .update({ notes, activated_at: new Date().toISOString() })
    .eq('id', org.id)

  const { data: linkData } = await adminSupabase.auth.admin.generateLink({ type: 'recovery', email })

  if (linkData?.properties?.action_link) {
    await resend.emails.send({
      from:    EMAIL_FROM,
      to:      email,
      subject: 'Bem-vindo ao seu novo CRM',
      html: `
        <h1>Olá, ${name}!</h1>
        <p>Sua conta no Althos CRM foi ativada.</p>
        <p>Para definir sua senha e acessar o sistema, clique no link abaixo:</p>
        <a href="${linkData.properties.action_link}">Definir Senha e Acessar</a>
      `,
    })
  }

  revalidatePath('/super-admin')
  return { ok: true as const, orgSlug: slug }
}

// ---------------------------------------------------------------------------
// Org usage detail (reads get_org_usage RPC)
// ---------------------------------------------------------------------------

export type OrgUsage = {
  org_id:     string
  account_id: string | null
  plan:       string
  status:     string
  period:     string
  usage:  { leads_total: number; leads_month: number; members: number; whatsapp_month: number; email_month: number; tasks_open: number }
  limits: { leads: number | null; whatsapp_monthly: number | null; email_monthly: number | null; users: number | null }
  ai_credits: { included: number; purchased: number; used: number; remaining: number; period: string }
}

export async function getOrgUsage(orgId: string): Promise<OrgUsage | null> {
  if (!(await isSuperAdmin())) return null
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_org_usage', { p_org_id: orgId })
  if (error || !data) return null
  return data as OrgUsage
}

// ---------------------------------------------------------------------------
// Users management
// ---------------------------------------------------------------------------

export type PlatformUserAccount = { id: string; name: string; role: string }

export type PlatformUser = {
  id:              string
  email:           string | null
  full_name:       string | null
  created_at:      string
  last_sign_in_at: string | null
  is_super_admin:  boolean
  accounts:        PlatformUserAccount[]
  org_count:       number
}

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
