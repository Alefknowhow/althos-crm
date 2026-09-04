'use server'

/**
 * Billing catalog: plans and coupons. Split out of
 * actions/super-admin.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { AdminPlan, AdminCoupon } from './super-admin-orgs'

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

