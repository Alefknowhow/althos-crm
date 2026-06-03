'use client'

/**
 * Client hook exposing the current account's subscription + AI credit balance,
 * for rendering plan gates and the credits badge.
 *
 * Scope is per ACCOUNT. The account is resolved from the logged-in user's
 * `account_members` row (admins/members of one account in this product). RLS
 * keeps reads scoped to the user's own account, so this is safe on the client.
 *
 * SECURITY: this is for UI only. Real enforcement is server-side
 * (lib/plans/server.ts → account_has_feature / consume_ai_credits).
 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PLAN_FEATURES,
  getPlanMeta,
  planHasFeature,
  type FeatureKey,
  type PlanId,
} from '@/lib/plans/config'

export interface SubscriptionState {
  loading: boolean
  accountId: string | null
  planId: PlanId
  status: string
  billingCycle: string
  isActive: boolean
  isSuperAdmin: boolean
  features: Record<FeatureKey, boolean>
  credits: { included: number; purchased: number; used: number; available: number }
  /** UI feature check — combines plan flags with active status. */
  hasFeature: (feature: FeatureKey) => boolean
  refresh: () => void
}

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

function periodMonth(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function useSubscription(): SubscriptionState {
  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [planId, setPlanId] = useState<PlanId>('free')
  const [status, setStatus] = useState<string>('active')
  const [billingCycle, setBillingCycle] = useState<string>('monthly')
  const [credits, setCredits] = useState({ included: 0, purchased: 0, used: 0, available: 0 })
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      setLoading(true)

      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }

      // Super-admin bypass: owner/staff keep full access regardless of plan.
      // Mirrors the SQL bypass in current_user_is_super_admin() so the UI never
      // gates them. Trust ONLY app_metadata (privileged, not self-editable).
      const appMeta = (user.app_metadata ?? {}) as { role?: string; is_super_admin?: boolean }
      const superAdmin = appMeta.is_super_admin === true || appMeta.role === 'super_admin'
      if (!cancelled) setIsSuperAdmin(superAdmin)

      // 1. Resolve the user's account (RLS-scoped).
      const { data: member } = await supabase
        .from('account_members')
        .select('account_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      const accId = (member?.account_id as string | null) ?? null
      if (!accId) {
        if (!cancelled) {
          setAccountId(null)
          setLoading(false)
        }
        return
      }

      // 2. Subscription + 3. credits, in parallel.
      const [{ data: sub }, { data: cred }] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('plan_id, status, billing_cycle')
          .eq('account_id', accId)
          .maybeSingle(),
        supabase
          .from('ai_credits')
          .select('credits_included, credits_purchased, credits_used')
          .eq('account_id', accId)
          .eq('period_month', periodMonth())
          .maybeSingle(),
      ])

      if (cancelled) return

      // Super-admin: present as Business with unlimited credits (UI only).
      const resolvedPlan: PlanId = superAdmin ? 'business' : ((sub?.plan_id as PlanId) ?? 'free')
      setAccountId(accId)
      setPlanId(resolvedPlan)
      setStatus(superAdmin ? 'active' : (sub?.status ?? 'active'))
      setBillingCycle(sub?.billing_cycle ?? 'monthly')

      if (superAdmin) {
        setCredits({ included: 999999, purchased: 0, used: 0, available: 999999 })
      } else if (cred) {
        const included = cred.credits_included ?? 0
        const purchased = cred.credits_purchased ?? 0
        const used = cred.credits_used ?? 0
        setCredits({ included, purchased, used, available: Math.max(0, included + purchased - used) })
      } else {
        const included = getPlanMeta(resolvedPlan).aiCreditsMonthly
        setCredits({ included, purchased: 0, used: 0, available: included })
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [tick])

  const isActive = ACTIVE_STATUSES.has(status)
  const features = PLAN_FEATURES[planId] ?? PLAN_FEATURES.free

  const hasFeature = useCallback(
    (feature: FeatureKey) => isSuperAdmin || (isActive && planHasFeature(planId, feature)),
    [isSuperAdmin, isActive, planId],
  )

  return {
    loading,
    accountId,
    planId,
    status,
    billingCycle,
    isActive,
    isSuperAdmin,
    features,
    credits,
    hasFeature,
    refresh,
  }
}
