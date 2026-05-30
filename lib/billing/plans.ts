/**
 * Central plan definitions.
 *
 * plan column in organizations:
 *   'trial'      – 7-day free trial (new self-signup)
 *   'free_trial' – legacy name for trial (grandfathered orgs, no expiry)
 *   'starter'    – R$ 197/mo, unlimited leads, 1 user, no AI, no automations
 *   'pro'        – R$ 397/mo, unlimited, AI + automations, up to 5 users
 *   'scale'      – R$ 697/mo, unlimited, advanced AI + API, unlimited users
 *   'agency'     – invite-only, unlimited, all features, billing_managed_externally
 *   'internal'   – Althos own accounts
 */

export type PlanKey = 'trial' | 'free_trial' | 'starter' | 'pro' | 'scale' | 'agency' | 'internal'

export interface PlanConfig {
  key:              PlanKey
  label:            string
  tagline:          string       // short positioning tag
  description:      string
  priceCents:       number | null  // null = manual/external
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
  trial: {
    key:               'trial',
    label:             'Trial Gratuito',
    tagline:           'Teste por 7 dias',
    description:       '7 dias para explorar tudo, sem compromisso.',
    priceCents:        0,
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
    priceCents:        39700,
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
  scale: {
    key:               'scale',
    label:             'Scale',
    tagline:           'Para escalar sem limites',
    description:       'Para empresas que precisam de mais controle, dados e performance em escala.',
    priceCents:        69700,
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
    asaasPlanKey:      'althos_scale',
  },
  agency: {
    key:               'agency',
    label:             'Agency',
    tagline:           'Exclusivo',
    description:       'Plano exclusivo para clientes da agência Althos.',
    priceCents:        null,
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

/** The three plans shown publicly in the checkout/upgrade page. */
export const PUBLIC_PLANS: PlanConfig[] = [PLANS.starter, PLANS.pro, PLANS.scale]

/** Plans that should never be blocked by billing gates. */
export const UNMANAGED_PLANS: PlanKey[] = ['agency', 'internal']

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
