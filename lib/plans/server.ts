/**
 * Server-only plan/billing helpers — the AUTHORITATIVE feature-gating layer.
 *
 * Everything here is scoped per ACCOUNT (accounts → N organizations). The new
 * source of truth is the `subscriptions` table (one row per account) joined to
 * the `plans` catalog. Feature checks and credit consumption defer to the SQL
 * functions `account_has_feature` and `consume_ai_credits` (SECURITY DEFINER),
 * so RLS and race-safety live in the DB.
 *
 * DO NOT import this from Client Components — it uses next/headers via the
 * server Supabase client. The client mirror lives in lib/plans/config.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { AI_CREDIT_COST, getPlanMeta, modelCreditMultiplier, type AiAction, type FeatureKey, type PlanId } from '@/lib/plans/config'

export interface AccountSubscription {
  accountId: string
  planId: PlanId
  status: string // trialing | active | past_due | canceled | ...
  billingCycle: string // monthly | annual
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  /** True when the subscription is in a state that grants feature access. */
  isActive: boolean
}

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

/**
 * Read the subscription for an account, joined to its plan id.
 * Returns null if no subscription row exists (treated as Free downstream).
 */
export async function getAccountSubscription(accountId: string): Promise<AccountSubscription | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('account_id, plan_id, status, billing_cycle, current_period_end, trial_ends_at')
    .eq('account_id', accountId)
    .maybeSingle()

  if (error) {
    console.error('[plans] getAccountSubscription error:', error.message)
    return null
  }
  if (!data) return null

  return {
    accountId: data.account_id,
    planId: (data.plan_id as PlanId) ?? 'free',
    status: data.status ?? 'active',
    billingCycle: data.billing_cycle ?? 'monthly',
    currentPeriodEnd: data.current_period_end ?? null,
    trialEndsAt: data.trial_ends_at ?? null,
    isActive: ACTIVE_STATUSES.has(data.status ?? ''),
  }
}

/**
 * Resolve the account_id behind an org slug, then return its subscription.
 * Convenience for pages/actions that only have the orgSlug in the route.
 */
export async function getSubscriptionByOrgSlug(orgSlug: string): Promise<AccountSubscription | null> {
  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return null
  return getAccountSubscription(accountId)
}

/** Resolve the parent account_id for an org slug (RLS-scoped). */
export async function getAccountIdForOrgSlug(orgSlug: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('account_id')
    .eq('slug', orgSlug)
    .maybeSingle()
  return (data?.account_id as string | null) ?? null
}

/**
 * AUTHORITATIVE feature gate. Calls the SQL function `account_has_feature`,
 * which reads the account's active subscription → plan → features jsonb.
 * Fails CLOSED (returns false) on any error.
 */
export async function checkFeatureAccess(accountId: string, feature: FeatureKey): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('account_has_feature', {
    p_account_id: accountId,
    p_feature: feature,
  })
  if (error) {
    console.error('[plans] checkFeatureAccess error:', error.message)
    return false
  }
  return data === true
}

/** Feature gate by org slug (resolves the parent account first). */
export async function checkFeatureAccessByOrgSlug(orgSlug: string, feature: FeatureKey): Promise<boolean> {
  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return false
  return checkFeatureAccess(accountId, feature)
}

export type ConsumeResult =
  | { success: true; remaining: number }
  | { success: false; error: string; remaining?: number }

/**
 * Debit AI credits for an action against an account's current-period balance.
 * Calls the race-safe SQL function `consume_ai_credits` (SELECT ... FOR UPDATE).
 *
 * `action` resolves its cost from AI_CREDIT_COST unless an explicit `credits`
 * override is given. The base cost is multiplied by the AI model's multiplier
 * (Haiku 1× · Sonnet/GPT-4o 3× · Opus 5×), since Althos pays the token bill —
 * pricier models burn credits faster. Fractional costs round UP (DB integers).
 */
export async function consumeAiCredits(opts: {
  accountId: string
  action: AiAction | string
  credits?: number
  model?: string | null
  leadId?: string | null
  metadata?: Record<string, unknown>
}): Promise<ConsumeResult> {
  const { accountId, action, model = null, leadId = null, metadata = {} } = opts
  const baseCost =
    opts.credits ?? AI_CREDIT_COST[action as AiAction] ?? 1
  const multiplier = modelCreditMultiplier(model)
  const cost = Math.max(1, Math.ceil(baseCost * multiplier))

  const supabase = createClient()
  const { data, error } = await supabase.rpc('consume_ai_credits', {
    p_account_id: accountId,
    p_action: action,
    p_credits: cost,
    p_lead_id: leadId,
    p_metadata: { ...metadata, model: model ?? undefined, multiplier },
  })

  if (error) {
    console.error('[plans] consumeAiCredits error:', error.message)
    return { success: false, error: 'rpc_error' }
  }

  // The function returns jsonb: {success:true, remaining} | {success:false, error}
  const res = (data ?? {}) as { success?: boolean; remaining?: number; error?: string }
  if (res.success) {
    return { success: true, remaining: res.remaining ?? 0 }
  }
  return { success: false, error: res.error ?? 'insufficient_credits', remaining: res.remaining }
}

export interface AiCreditsStatus {
  periodMonth: string
  included: number
  purchased: number
  used: number
  available: number
}

/**
 * Current-period AI credit balance for an account. If no row exists yet for
 * this month, falls back to the plan's monthly allotment with 0 used.
 */
export async function getAiCreditsStatus(accountId: string): Promise<AiCreditsStatus> {
  const supabase = createClient()
  const periodMonth = currentPeriodMonth()

  const { data } = await supabase
    .from('ai_credits')
    .select('period_month, credits_included, credits_purchased, credits_used')
    .eq('account_id', accountId)
    .eq('period_month', periodMonth)
    .maybeSingle()

  if (data) {
    const included = data.credits_included ?? 0
    const purchased = data.credits_purchased ?? 0
    const used = data.credits_used ?? 0
    return {
      periodMonth,
      included,
      purchased,
      used,
      available: Math.max(0, included + purchased - used),
    }
  }

  // No row yet — derive the allotment from the account's plan.
  const sub = await getAccountSubscription(accountId)
  const included = getPlanMeta(sub?.planId ?? 'free').aiCreditsMonthly
  return {
    periodMonth,
    included,
    purchased: 0,
    used: 0,
    available: included,
  }
}

/** Period key used by the ai_credits table: 'YYYY-MM' (UTC). */
export function currentPeriodMonth(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
