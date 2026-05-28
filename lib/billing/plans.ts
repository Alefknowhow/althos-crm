/**
 * Central plan definitions.
 *
 * plan column in organizations:
 *   'trial'      – 7-day free trial (new self-signup)
 *   'free_trial' – legacy name for trial (grandfathered orgs, no expiry)
 *   'starter'    – R$ 197/mo, 500 leads, no AI, no automations
 *   'pro'        – R$ 397/mo, unlimited, all features
 *   'agency'     – invite-only, unlimited, all features, billing_managed_externally
 *   'internal'   – Althos own accounts
 */

export type PlanKey = 'trial' | 'free_trial' | 'starter' | 'pro' | 'agency' | 'internal'

export interface PlanConfig {
  key:            PlanKey
  label:          string
  description:    string
  priceCents:     number | null  // null = manual/external
  maxLeads:       number | null  // null = unlimited
  hasAI:          boolean
  hasAutomations: boolean
  hasWhatsApp:    boolean
  isPublicPlan:   boolean        // shown in the checkout UI
  asaasPlanKey:   string | null  // key sent to Asaas description
}

export const PLANS: Record<PlanKey, PlanConfig> = {
  trial: {
    key:            'trial',
    label:          'Trial Gratuito',
    description:    '7 dias para testar o CRM com até 50 leads.',
    priceCents:     0,
    maxLeads:       50,
    hasAI:          false,
    hasAutomations: false,
    hasWhatsApp:    true,
    isPublicPlan:   false,
    asaasPlanKey:   null,
  },
  free_trial: {
    key:            'free_trial',
    label:          'Trial Gratuito',
    description:    'Plano gratuito legado.',
    priceCents:     0,
    maxLeads:       50,
    hasAI:          false,
    hasAutomations: false,
    hasWhatsApp:    true,
    isPublicPlan:   false,
    asaasPlanKey:   null,
  },
  starter: {
    key:            'starter',
    label:          'Starter',
    description:    'Ideal para pequenos times que estão crescendo.',
    priceCents:     19700,
    maxLeads:       500,
    hasAI:          false,
    hasAutomations: false,
    hasWhatsApp:    true,
    isPublicPlan:   true,
    asaasPlanKey:   'althos_starter',
  },
  pro: {
    key:            'pro',
    label:          'Pro',
    description:    'Para times que querem escalar com IA e automações.',
    priceCents:     39700,
    maxLeads:       null,
    hasAI:          true,
    hasAutomations: true,
    hasWhatsApp:    true,
    isPublicPlan:   true,
    asaasPlanKey:   'althos_pro',
  },
  agency: {
    key:            'agency',
    label:          'Agency',
    description:    'Plano exclusivo para clientes da agência Althos.',
    priceCents:     null,
    maxLeads:       null,
    hasAI:          true,
    hasAutomations: true,
    hasWhatsApp:    true,
    isPublicPlan:   false,
    asaasPlanKey:   null,
  },
  internal: {
    key:            'internal',
    label:          'Interno',
    description:    'Conta interna Althos.',
    priceCents:     null,
    maxLeads:       null,
    hasAI:          true,
    hasAutomations: true,
    hasWhatsApp:    true,
    isPublicPlan:   false,
    asaasPlanKey:   null,
  },
}

/** Resolve any unknown plan name to its config, defaulting to trial. */
export function getPlan(planName: string | null | undefined): PlanConfig {
  if (!planName) return PLANS.trial
  return PLANS[planName as PlanKey] ?? PLANS.trial
}

/** The two plans shown publicly in the checkout/upgrade page. */
export const PUBLIC_PLANS: PlanConfig[] = [PLANS.starter, PLANS.pro]

/** Plans that should never be blocked by billing gates. */
export const UNMANAGED_PLANS: PlanKey[] = ['agency', 'internal']

/**
 * Determines whether an org's subscription is effectively blocked (expired
 * trial, canceled subscription, etc.).
 *
 * Returns false for grandfathered orgs (free_trial with no trial_ends_at) and
 * for agency/internal accounts.
 */
export function isAccessBlocked(org: {
  plan:                     string | null
  trial_ends_at:            string | null
  subscription_status:      string | null
  billing_managed_externally: boolean | null
}): boolean {
  const plan = (org.plan ?? 'trial') as PlanKey

  // Managed / special accounts are never blocked
  if (org.billing_managed_externally) return false
  if (UNMANAGED_PLANS.includes(plan))  return false

  // Trial plans
  if (plan === 'trial' || plan === 'free_trial') {
    // Grandfathered: no expiry date → never blocked
    if (!org.trial_ends_at) return false
    return new Date(org.trial_ends_at) < new Date()
  }

  // Paid plans — block only on hard-cancel
  if (org.subscription_status === 'canceled') return true

  return false
}

/** Format price as BR currency string. */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
