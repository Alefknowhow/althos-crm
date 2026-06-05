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
  key:                PlanKey
  label:              string
  tagline:            string       // short positioning tag
  description:        string
  priceCents:         number | null  // monthly price; null = manual/external
  priceCentsSemestral:number | null  // total paid once per 6 months (~10% off); null = n/a
  priceCentsAnnual:   number | null  // total paid once per year (~18% off); null = n/a
  maxLeads:           number | null  // null = unlimited
  maxUsers:           number | null  // null = unlimited
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
    priceCents:         0,
    priceCentsSemestral:0,
    priceCentsAnnual:   0,
    maxLeads:           100,
    maxUsers:           1,
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
    priceCents:         0,
    priceCentsSemestral:null,
    priceCentsAnnual:   null,
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
    priceCents:         0,
    priceCentsSemestral:null,
    priceCentsAnnual:   null,
    maxLeads:           null,
    maxUsers:           1,
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
    priceCents:         13700,
    priceCentsSemestral:73980,   // R$ 739,80/semestre (−10% vs 6×137)
    priceCentsAnnual:   134808,  // R$ 1.348,08/ano (−18% vs 12×137)
    maxLeads:           null,    // unlimited
    maxUsers:           1,
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
    priceCents:         39700,
    priceCentsSemestral:214380,  // R$ 2.143,80/semestre (−10% vs 6×397)
    priceCentsAnnual:   390648,  // R$ 3.906,48/ano (−18% vs 12×397)
    maxLeads:           null,
    maxUsers:           6,        // titular + 5 convidados
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
    priceCents:         69700,
    priceCentsSemestral:376380,  // R$ 3.763,80/semestre (−10% vs 6×697)
    priceCentsAnnual:   685848,  // R$ 6.858,48/ano (−18% vs 12×697)
    maxLeads:           null,
    maxUsers:           null,    // unlimited
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
    priceCents:         69700,
    priceCentsSemestral:376380,
    priceCentsAnnual:   685848,
    maxLeads:           null,
    maxUsers:           null,
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
    priceCents:         null,
    priceCentsSemestral:null,
    priceCentsAnnual:   null,
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
    priceCents:         null,
    priceCentsSemestral:null,
    priceCentsAnnual:   null,
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
