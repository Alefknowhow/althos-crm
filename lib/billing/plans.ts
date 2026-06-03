/**
 * Central plan definitions.
 *
 * plan column in organizations (NEW taxonomy — free/starter/pro/business):
 *   'free'       – Gratuito para sempre, recursos básicos, sem cartão
 *   'starter'    – R$ 197/mo, leads ilimitados, 1 user, catálogo + WhatsApp
 *   'pro'        – R$ 297/mo, IA (atendente/score) + agendamentos + Meta Ads, até 5 users
 *   'business'   – R$ 397/mo, tudo (insights IA, white-label, multi-tenant, API), users ilimitados
 *   'agency'     – invite-only, unlimited, all features, billing_managed_externally
 *   'internal'   – Althos own accounts
 *
 * Legacy (grandfathered) keys kept so existing org rows / webhooks still resolve:
 *   'trial'      – 7-day free trial (old self-signup)
 *   'free_trial' – old name for trial (no expiry)
 *   'scale'      – old top tier, renamed to 'business' (hidden alias)
 */

export type PlanKey =
  | 'free'
  | 'trial'
  | 'free_trial'
  | 'starter'
  | 'pro'
  | 'business'
  | 'scale'
  | 'agency'
  | 'internal'

export interface PlanConfig {
  key:              PlanKey
  label:            string
  tagline:          string       // short positioning tag
  description:      string
  priceCents:       number | null  // monthly price; null = manual/external
  priceCentsAnnual: number | null  // total paid once per year (already ~18% off); null = n/a
  maxLeads:         number | null  // null = unlimited
  maxUsers:         number | null  // null = unlimited
  hasAI:            boolean
  hasAdvancedAI:    boolean       // forecasts, advanced analysis
  hasAutomations:   boolean
  hasAdvancedAuto:  boolean       // advanced conditional flows
  hasWhatsApp:      boolean
  hasInstagram:     boolean
  hasMetaAds:       boolean
  hasEmailMarketing:boolean
  hasAPI:           boolean
  hasDedicatedManager: boolean
  isPublicPlan:     boolean        // shown in the checkout UI
  asaasPlanKey:     string | null  // key sent to Asaas description
}

export const PLANS: Record<PlanKey, PlanConfig> = {
  free: {
    key:               'free',
    label:             'Free',
    tagline:           'Para dar o primeiro passo',
    description:       'Gratuito para sempre. Organize seus leads e o pipeline, sem cartão de crédito.',
    priceCents:        0,
    priceCentsAnnual:  0,
    maxLeads:          50,
    maxUsers:          1,
    hasAI:             false,
    hasAdvancedAI:     false,
    hasAutomations:    false,
    hasAdvancedAuto:   false,
    hasWhatsApp:       false,
    hasInstagram:      false,
    hasMetaAds:        false,
    hasEmailMarketing: false,
    hasAPI:            false,
    hasDedicatedManager: false,
    isPublicPlan:      false, // shown as a separate Free card on the marketing site, not in checkout
    asaasPlanKey:      null,
  },
  trial: {
    key:               'trial',
    label:             'Trial Gratuito',
    tagline:           'Teste por 7 dias',
    description:       '7 dias para explorar tudo, sem compromisso.',
    priceCents:        0,
    priceCentsAnnual:  null,
    maxLeads:          null,
    maxUsers:          1,
    hasAI:             false,
    hasAdvancedAI:     false,
    hasAutomations:    false,
    hasAdvancedAuto:   false,
    hasWhatsApp:       true,
    hasInstagram:      false,
    hasMetaAds:        false,
    hasEmailMarketing: false,
    hasAPI:            false,
    hasDedicatedManager: false,
    isPublicPlan:      false,
    asaasPlanKey:      null,
  },
  free_trial: {
    key:               'free_trial',
    label:             'Trial Gratuito',
    tagline:           'Legado',
    description:       'Plano gratuito legado.',
    priceCents:        0,
    priceCentsAnnual:  null,
    maxLeads:          null,
    maxUsers:          1,
    hasAI:             false,
    hasAdvancedAI:     false,
    hasAutomations:    false,
    hasAdvancedAuto:   false,
    hasWhatsApp:       true,
    hasInstagram:      false,
    hasMetaAds:        false,
    hasEmailMarketing: false,
    hasAPI:            false,
    hasDedicatedManager: false,
    isPublicPlan:      false,
    asaasPlanKey:      null,
  },
  starter: {
    key:               'starter',
    label:             'Starter',
    tagline:           'Ideal para começar',
    description:       'Para pequenos negócios que querem organizar e profissionalizar o atendimento.',
    priceCents:        19700,
    priceCentsAnnual:  194000,  // R$ 1.940/ano (~18% off vs 12×197)
    maxLeads:          null,    // unlimited
    maxUsers:          1,
    hasAI:             false,
    hasAdvancedAI:     false,
    hasAutomations:    false,
    hasAdvancedAuto:   false,
    hasWhatsApp:       true,
    hasInstagram:      false,
    hasMetaAds:        false,
    hasEmailMarketing: false,
    hasAPI:            false,
    hasDedicatedManager: false,
    isPublicPlan:      true,
    asaasPlanKey:      'althos_starter',
  },
  pro: {
    key:               'pro',
    label:             'Pro',
    tagline:           'Para crescer',
    description:       'Para empresas que querem automatizar processos e aumentar as vendas.',
    priceCents:        29700,
    priceCentsAnnual:  290000,  // R$ 2.900/ano (~18% off vs 12×297)
    maxLeads:          null,
    maxUsers:          5,
    hasAI:             true,
    hasAdvancedAI:     false,
    hasAutomations:    true,
    hasAdvancedAuto:   false,
    hasWhatsApp:       true,
    hasInstagram:      true,
    hasMetaAds:        true,
    hasEmailMarketing: true,
    hasAPI:            false,
    hasDedicatedManager: false,
    isPublicPlan:      true,
    asaasPlanKey:      'althos_pro',
  },
  business: {
    key:               'business',
    label:             'Business',
    tagline:           'Para escalar sem limites',
    description:       'Para empresas que precisam de mais controle, dados e performance em escala.',
    priceCents:        39700,
    priceCentsAnnual:  390000,  // R$ 3.900/ano (~18% off vs 12×397)
    maxLeads:          null,
    maxUsers:          null,    // unlimited
    hasAI:             true,
    hasAdvancedAI:     true,
    hasAutomations:    true,
    hasAdvancedAuto:   true,
    hasWhatsApp:       true,
    hasInstagram:      true,
    hasMetaAds:        true,
    hasEmailMarketing: true,
    hasAPI:            true,
    hasDedicatedManager: true,
    isPublicPlan:      true,
    asaasPlanKey:      'althos_business',
  },
  // Legacy top tier (renamed to Business). Kept hidden so grandfathered org
  // rows / old Asaas webhooks with plan='scale' still resolve to full access.
  scale: {
    key:               'scale',
    label:             'Business',
    tagline:           'Para escalar sem limites',
    description:       'Para empresas que precisam de mais controle, dados e performance em escala.',
    priceCents:        39700,
    priceCentsAnnual:  390000,
    maxLeads:          null,
    maxUsers:          null,
    hasAI:             true,
    hasAdvancedAI:     true,
    hasAutomations:    true,
    hasAdvancedAuto:   true,
    hasWhatsApp:       true,
    hasInstagram:      true,
    hasMetaAds:        true,
    hasEmailMarketing: true,
    hasAPI:            true,
    hasDedicatedManager: true,
    isPublicPlan:      false,
    asaasPlanKey:      'althos_business',
  },
  agency: {
    key:               'agency',
    label:             'Agency',
    tagline:           'Exclusivo',
    description:       'Plano exclusivo para clientes da agência Althos.',
    priceCents:        null,
    priceCentsAnnual:  null,
    maxLeads:          null,
    maxUsers:          null,
    hasAI:             true,
    hasAdvancedAI:     true,
    hasAutomations:    true,
    hasAdvancedAuto:   true,
    hasWhatsApp:       true,
    hasInstagram:      true,
    hasMetaAds:        true,
    hasEmailMarketing: true,
    hasAPI:            true,
    hasDedicatedManager: true,
    isPublicPlan:      false,
    asaasPlanKey:      null,
  },
  internal: {
    key:               'internal',
    label:             'Interno',
    tagline:           'Interno',
    description:       'Conta interna Althos.',
    priceCents:        null,
    priceCentsAnnual:  null,
    maxLeads:          null,
    maxUsers:          null,
    hasAI:             true,
    hasAdvancedAI:     true,
    hasAutomations:    true,
    hasAdvancedAuto:   true,
    hasWhatsApp:       true,
    hasInstagram:      true,
    hasMetaAds:        true,
    hasEmailMarketing: true,
    hasAPI:            true,
    hasDedicatedManager: false,
    isPublicPlan:      false,
    asaasPlanKey:      null,
  },
}

/** Resolve any unknown plan name to its config, defaulting to trial. */
export function getPlan(planName: string | null | undefined): PlanConfig {
  if (!planName) return PLANS.trial
  return PLANS[planName as PlanKey] ?? PLANS.trial
}

/** The three PAID plans shown in the checkout/upgrade flow. Free is shown as a
 * separate card on the marketing site and is never part of checkout. */
export const PUBLIC_PLANS: PlanConfig[] = [PLANS.starter, PLANS.pro, PLANS.business]

/** Plans that should never be blocked by billing gates. */
export const UNMANAGED_PLANS: PlanKey[] = ['free', 'agency', 'internal']

/**
 * Determines whether an org's subscription is effectively blocked (expired
 * trial, canceled subscription, etc.).
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

/** Format price as BR currency string. */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Billing cycle selectable in the public pricing page and checkout. */
export type BillingCycle = 'monthly' | 'annual'

/**
 * Discount applied to the annual (à vista) price vs. paying 12 monthly charges.
 * Used for the "-18%" badge and the strikethrough comparison on the pricing UI.
 */
export const ANNUAL_DISCOUNT_PCT = 18

/**
 * Pricing breakdown for a plan + cycle, ready for UI.
 *  - monthly: charged every month.
 *  - annual:  charged once/year (priceCentsAnnual); we also expose the
 *    per-month equivalent for the "equivale a R$ X/mês" line.
 */
export function getPlanPricing(plan: PlanConfig, cycle: BillingCycle) {
  if (cycle === 'annual' && plan.priceCentsAnnual != null) {
    const totalAnnual   = plan.priceCentsAnnual
    const perMonthEquiv = Math.round(totalAnnual / 12)
    const fullYear      = (plan.priceCents ?? 0) * 12
    const savedCents    = Math.max(0, fullYear - totalAnnual)
    return {
      cycle:            'annual' as const,
      totalCents:       totalAnnual,
      perMonthCents:    perMonthEquiv,
      fullYearCents:    fullYear,
      savedCents,
      perMonthLabel:    formatPrice(perMonthEquiv),
      totalLabel:       formatPrice(totalAnnual),
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
