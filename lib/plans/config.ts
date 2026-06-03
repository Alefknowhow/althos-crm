/**
 * Client-safe mirror of the database `plans` catalog (migration 0057).
 *
 * SOURCE OF TRUTH: the `plans` table + the `subscriptions` table per ACCOUNT.
 * This file duplicates the static shape (feature flags, prices, AI credits) so
 * the UI can render gates/labels without a round-trip. Enforcement, however,
 * ALWAYS happens server-side via `account_has_feature` / `consume_ai_credits`
 * (see lib/plans/server.ts) — never trust these constants for security.
 *
 * Keep in sync with the seeds in supabase/migrations/0057_billing_plans.sql.
 *
 * NOTE: this is the NEW plan taxonomy (free/starter/pro/business) scoped per
 * Account. The legacy per-org taxonomy in lib/billing/plans.ts
 * (trial/starter/pro/scale/agency/internal) remains for the public marketing
 * site until Prompt 8 reconciles it.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'business'

export const PLAN_IDS: PlanId[] = ['free', 'starter', 'pro', 'business']

/** Every gateable capability. Mirrors the `features` jsonb keys in `plans`. */
export type FeatureKey =
  | 'tasks'
  | 'catalogo'
  | 'whatsapp'
  | 'capi_pixel'
  | 'ai_insights'
  | 'white_label'
  | 'agendamentos'
  | 'ai_attendant'
  | 'lead_scoring'
  | 'multi_tenant'
  | 'export_reports'
  | 'meta_ads_panel'
  | 'instagram_automation'

export const FEATURE_KEYS: FeatureKey[] = [
  'tasks',
  'catalogo',
  'whatsapp',
  'capi_pixel',
  'ai_insights',
  'white_label',
  'agendamentos',
  'ai_attendant',
  'lead_scoring',
  'multi_tenant',
  'export_reports',
  'meta_ads_panel',
  'instagram_automation',
]

/** Per-plan feature flags — mirror of `plans.features`. */
export const PLAN_FEATURES: Record<PlanId, Record<FeatureKey, boolean>> = {
  free: {
    tasks: false,
    catalogo: false,
    whatsapp: false,
    capi_pixel: false,
    ai_insights: false,
    white_label: false,
    agendamentos: false,
    ai_attendant: false,
    lead_scoring: false,
    multi_tenant: false,
    export_reports: false,
    meta_ads_panel: false,
    instagram_automation: false,
  },
  starter: {
    tasks: true,
    catalogo: true,
    whatsapp: true,
    capi_pixel: false,
    ai_insights: false,
    white_label: false,
    agendamentos: false,
    ai_attendant: false,
    lead_scoring: false,
    multi_tenant: false,
    export_reports: false,
    meta_ads_panel: false,
    instagram_automation: false,
  },
  pro: {
    tasks: true,
    catalogo: true,
    whatsapp: true,
    capi_pixel: true,
    ai_insights: false,
    white_label: false,
    agendamentos: true,
    ai_attendant: true,
    lead_scoring: true,
    multi_tenant: false,
    export_reports: false,
    meta_ads_panel: true,
    instagram_automation: true,
  },
  business: {
    tasks: true,
    catalogo: true,
    whatsapp: true,
    capi_pixel: true,
    ai_insights: true,
    white_label: true,
    agendamentos: true,
    ai_attendant: true,
    lead_scoring: true,
    multi_tenant: true,
    export_reports: true,
    meta_ads_panel: true,
    instagram_automation: true,
  },
}

export interface PlanMeta {
  id: PlanId
  name: string
  priceMonthlyCents: number
  priceAnnualCents: number
  aiCreditsMonthly: number
}

/** Static plan metadata — mirror of the `plans` price/credit columns. */
export const PLAN_META: Record<PlanId, PlanMeta> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    aiCreditsMonthly: 0,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthlyCents: 19700,
    priceAnnualCents: 194000,
    aiCreditsMonthly: 50,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthlyCents: 29700,
    priceAnnualCents: 290000,
    aiCreditsMonthly: 200,
  },
  business: {
    id: 'business',
    name: 'Business',
    priceMonthlyCents: 39700,
    priceAnnualCents: 390000,
    aiCreditsMonthly: 600,
  },
}

/**
 * Cost (in AI credits) of each AI action. Mirrors the cost used by
 * `consume_ai_credits`. NOTE: DB credits are integer; fractional costs are
 * rounded UP at consume time (see consumeAiCredits in lib/plans/server.ts).
 */
export const AI_CREDIT_COST = {
  qualify_lead: 1,
  ai_attendant_reply: 1,
  ai_insights_query: 2,
  lead_scoring: 1, // doc spec was 0.5 — rounded up to 1 because credits are integer
  generate_proposal: 3,
} as const

export type AiAction = keyof typeof AI_CREDIT_COST

/** Human-readable labels for features (UI: gates, upgrade modal, pricing). */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  tasks: 'Tarefas',
  catalogo: 'Catálogo de produtos',
  whatsapp: 'WhatsApp',
  capi_pixel: 'Pixel + CAPI (Meta)',
  ai_insights: 'Insights com IA',
  white_label: 'White-label',
  agendamentos: 'Agendamentos',
  ai_attendant: 'Atendente IA',
  lead_scoring: 'Lead scoring',
  multi_tenant: 'Multi-tenant',
  export_reports: 'Exportar relatórios',
  meta_ads_panel: 'Painel de Meta Ads',
  instagram_automation: 'Automação de Instagram',
}

/** True if the given plan includes the given feature (static check). */
export function planHasFeature(plan: PlanId | string | null | undefined, feature: FeatureKey): boolean {
  const flags = PLAN_FEATURES[(plan as PlanId)] ?? PLAN_FEATURES.free
  return flags[feature] === true
}

/** The lowest plan (in catalog order) that includes a given feature. */
export function minimumPlanFor(feature: FeatureKey): PlanId | null {
  for (const id of PLAN_IDS) {
    if (PLAN_FEATURES[id][feature]) return id
  }
  return null
}

/** Resolve a plan id to its metadata, defaulting to Free. */
export function getPlanMeta(plan: PlanId | string | null | undefined): PlanMeta {
  return PLAN_META[(plan as PlanId)] ?? PLAN_META.free
}

/** Format a price in cents as BRL. */
export function formatPlanPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
