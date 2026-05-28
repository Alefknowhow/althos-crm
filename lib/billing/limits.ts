import { createClient } from '@/lib/supabase/server'
import { getPlan } from '@/lib/billing/plans'

// "No limit" defaults used when the org row can't be read or has null limit
// columns — limits are a soft feature and should never block core operations
// like creating a lead. Better to over-allow than to crash on a SELECT failure.
const NO_LIMITS = {
  leads: { used: 0, limit: Infinity, pct: 0 },
  whatsapp: { used: 0, limit: Infinity, pct: 0 },
  email: { used: 0, limit: Infinity, pct: 0 },
  users: { used: 0, limit: Infinity, pct: 0 },
}

export async function getUsageStatus(orgId: string) {
  const supabase = createClient()

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('limit_leads, limit_whatsapp_monthly, limit_email_monthly, limit_users')
    .eq('id', orgId)
    .maybeSingle()

  // If org isn't readable for any reason (RLS, missing billing columns,
  // brand-new org), don't throw — fall back to "no limits".
  if (orgError || !org) {
    if (orgError) console.error('getUsageStatus org read error:', orgError)
    return NO_LIMITS
  }

  const { count: currentLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  const { data: usage } = await supabase
    .from('usage_counters')
    .select('*')
    .eq('organization_id', orgId)
    .gte('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    .maybeSingle()

  const { count: currentUsers } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  return {
    leads: {
      used: currentLeads || 0,
      limit: org.limit_leads || Infinity,
      pct: org.limit_leads ? ((currentLeads || 0) / org.limit_leads) * 100 : 0,
    },
    whatsapp: {
      used: usage?.whatsapp_count || 0,
      limit: org.limit_whatsapp_monthly || Infinity,
      pct: org.limit_whatsapp_monthly
        ? ((usage?.whatsapp_count || 0) / org.limit_whatsapp_monthly) * 100
        : 0,
    },
    email: {
      used: usage?.email_count || 0,
      limit: org.limit_email_monthly || Infinity,
      pct: org.limit_email_monthly
        ? ((usage?.email_count || 0) / org.limit_email_monthly) * 100
        : 0,
    },
    users: {
      used: currentUsers || 0,
      limit: org.limit_users || Infinity,
      pct: org.limit_users ? ((currentUsers || 0) / org.limit_users) * 100 : 0,
    },
  }
}

export async function canCreateLead(orgId: string) {
  const status = await getUsageStatus(orgId)
  return status.leads.used < status.leads.limit
}

export async function canSendWhatsapp(orgId: string) {
  const status = await getUsageStatus(orgId)
  return status.whatsapp.used < status.whatsapp.limit
}

export async function canSendEmail(orgId: string) {
  const status = await getUsageStatus(orgId)
  return status.email.used < status.email.limit
}

export async function canAddUser(orgId: string) {
  const status = await getUsageStatus(orgId)
  return status.users.used < status.users.limit
}

// ── Feature gates based on plan ───────────────────────────────────────────────

async function getOrgPlan(orgId: string): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .maybeSingle()
  return data?.plan ?? 'trial'
}

export async function canUseAI(orgId: string): Promise<boolean> {
  const plan = await getOrgPlan(orgId)
  return getPlan(plan).hasAI
}

export async function canUseAutomations(orgId: string): Promise<boolean> {
  const plan = await getOrgPlan(orgId)
  return getPlan(plan).hasAutomations
}

/**
 * Returns how many days remain in the trial, or null if not on a trial plan.
 * Returns 0 if the trial has already expired.
 */
export async function getTrialDaysRemaining(orgId: string): Promise<number | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('plan, trial_ends_at')
    .eq('id', orgId)
    .maybeSingle()

  if (!data) return null
  if (data.plan !== 'trial' && data.plan !== 'free_trial') return null
  if (!data.trial_ends_at) return null

  const diff = new Date(data.trial_ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
