/**
 * Billing access gates and pricing helpers. Plan definitions
 * (PlanKey/PlanConfig/PLANS/getPlan/PUBLIC_PLANS/UNMANAGED_PLANS) split
 * out to plans-data.ts.
 */

import { UNMANAGED_PLANS, type PlanKey, type PlanConfig } from './plans-data'

export * from './plans-data'

/**
 * Determines whether an org is "frozen" (expired trial without a paid
 * subscription, or a canceled subscription). A frozen org is NOT locked out —
 * the app layout still renders normally (read access), but write actions must
 * refuse via requireWritableOrg() below. See app/app/[orgSlug]/layout.tsx.
 */
export function isAccessBlocked(org: {
  plan:                     string | null
  trial_ends_at:            string | null
  subscription_status:      string | null
  billing_managed_externally: boolean | null
}): boolean {
  const plan = (org.plan ?? 'trial') as PlanKey

  if (org.billing_managed_externally) return false
  if (UNMANAGED_PLANS.includes(plan))  return false

  if (plan === 'trial' || plan === 'free_trial') {
    if (!org.trial_ends_at) return false
    return new Date(org.trial_ends_at) < new Date()
  }

  if (org.subscription_status === 'canceled') return true

  return false
}

/**
 * Guard for server actions that WRITE data. A frozen org (expired trial,
 * canceled subscription) can still be viewed, but must not be able to
 * create/update/delete anything until it upgrades. Call at the top of a
 * mutating action, right after fetching the org:
 *
 *   const org = await getCurrentOrganization(orgSlug)
 *   assertOrgWritable(org)
 *
 * Throws a plain Error with a user-facing PT-BR message — action handlers in
 * this codebase already catch and surface thrown errors as { ok: false, error }.
 */
export function assertOrgWritable(org: {
  plan:                     string | null
  trial_ends_at:            string | null
  subscription_status:      string | null
  billing_managed_externally: boolean | null
}): void {
  if (isAccessBlocked(org)) {
    throw new Error(
      'Sua conta está congelada (teste expirado ou assinatura cancelada). Assine um plano para voltar a editar.',
    )
  }
}

/** Format price as BR currency string. */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Billing cycle selectable in the public pricing page and checkout. */
export type BillingCycle = 'monthly' | 'semestral' | 'annual'

/** Discount (%) of each cycle vs. paying N monthly charges. Used for badges. */
export const ANNUAL_DISCOUNT_PCT = 18
export const SEMESTRAL_DISCOUNT_PCT = 10

/** Months covered by each cycle (for the "equivale a R$ X/mês" line). */
const CYCLE_MONTHS: Record<BillingCycle, number> = { monthly: 1, semestral: 6, annual: 12 }

/**
 * Pricing breakdown for a plan + cycle, ready for UI.
 *  - monthly:   charged every month.
 *  - semestral: charged once every 6 months (priceCentsSemestral, ~10% off).
 *  - annual:    charged once/year (priceCentsAnnual, ~18% off).
 * For semestral/annual we also expose the per-month equivalent.
 */
export function getPlanPricing(plan: PlanConfig, cycle: BillingCycle) {
  const months = CYCLE_MONTHS[cycle]
  const cycleTotal =
    cycle === 'annual' ? plan.priceCentsAnnual
    : cycle === 'semestral' ? plan.priceCentsSemestral
    : plan.priceCents

  if (cycle !== 'monthly' && cycleTotal != null) {
    const perMonthEquiv = Math.round(cycleTotal / months)
    const fullPrice     = (plan.priceCents ?? 0) * months
    const savedCents    = Math.max(0, fullPrice - cycleTotal)
    return {
      cycle,
      totalCents:       cycleTotal,
      perMonthCents:    perMonthEquiv,
      fullYearCents:    fullPrice,
      savedCents,
      perMonthLabel:    formatPrice(perMonthEquiv),
      totalLabel:       formatPrice(cycleTotal),
      savedLabel:       formatPrice(savedCents),
    }
  }
  const monthly = plan.priceCents ?? 0
  return {
    cycle:            'monthly' as const,
    totalCents:       monthly,
    perMonthCents:    monthly,
    fullYearCents:    monthly * 12,
    savedCents:       0,
    perMonthLabel:    formatPrice(monthly),
    totalLabel:       formatPrice(monthly),
    savedLabel:       formatPrice(0),
  }
}
