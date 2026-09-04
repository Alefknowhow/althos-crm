'use server'

/**
 * Organization listing/limits and audit logs. Split out of
 * actions/super-admin.ts.
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { getProfilesMap } from '@/lib/profiles'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { SuperAdminOrg } from './super-admin-metrics'

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

