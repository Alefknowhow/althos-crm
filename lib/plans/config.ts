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
  priceSemestralCents: number
  priceAnnualCents: number
  aiCreditsMonthly: number
}

/**
 * Static plan metadata — mirror of the `plans` price/credit columns.
 * Prices reflect the junho/2026 revamp (migration 0064):
 *   Starter R$137 · Pro R$397 · Business R$697 (mensal).
 *   Semestral −10% · Anual −18% (totais pagos por ciclo, já com desconto).
 */
export const PLAN_META: Record<PlanId, PlanMeta> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    priceSemestralCents: 0,
    priceAnnualCents: 0,
    aiCreditsMonthly: 0,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthlyCents: 13700,
    priceSemestralCents: 73980,
    priceAnnualCents: 134808,
    aiCreditsMonthly: 300,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthlyCents: 39700,
    priceSemestralCents: 214380,
    priceAnnualCents: 390648,
    aiCreditsMonthly: 1200,
  },
  business: {
    id: 'business',
    name: 'Business',
    priceMonthlyCents: 69700,
    priceSemestralCents: 376380,
    priceAnnualCents: 685848,
    aiCreditsMonthly: 3000,
  },
}

/**
 * Limites de uso por plano (espelho de plans.max_*). Convenção: -1 = ilimitado.
 * Enforcement é server-side; estes valores alimentam UI (badges, gates, upgrade).
 */
export interface PlanLimits {
  pipelines: number
  automations: number      // automações ativas
  automationRuns: number   // disparos de automação por mês
  socialAccounts: number   // contas de Social/DM conectadas
  socialMessages: number   // DMs/disparos de social por mês
  customers: number        // registros de clientes
  users: number
  leads: number            // leads no pipeline (-1 = ilimitado)
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free:     { pipelines: 1,  automations: 0,  automationRuns: 0,     socialAccounts: 0,  socialMessages: 0,    customers: 50,   users: 1,  leads: 100 },
  starter:  { pipelines: 2,  automations: 5,  automationRuns: 1000,  socialAccounts: 1,  socialMessages: 500,  customers: 500,  users: 1,  leads: -1 },
  pro:      { pipelines: 5,  automations: 20, automationRuns: 10000, socialAccounts: 3,  socialMessages: 5000, customers: 2000, users: 6,  leads: -1 },
  business: { pipelines: -1, automations: -1, automationRuns: -1,    socialAccounts: -1, socialMessages: -1,   customers: -1,   users: -1, leads: -1 },
}

/** Limite de um plano para um recurso (Infinity quando ilimitado). */
export function getPlanLimit(plan: PlanId | string | null | undefined, key: keyof PlanLimits): number {
  const limits = PLAN_LIMITS[(plan as PlanId)] ?? PLAN_LIMITS.free
  const v = limits[key]
  return v === -1 ? Infinity : v
}

/** Ciclos de cobrança disponíveis. */
export type PlanBillingCycle = 'monthly' | 'semestral' | 'annual'

/** Desconto (%) de cada ciclo vs. pagar N parcelas mensais. */
export const CYCLE_DISCOUNT_PCT: Record<PlanBillingCycle, number> = {
  monthly: 0,
  semestral: 10,
  annual: 18,
}

/** Nº de meses cobertos por cada ciclo (para "equivale a R$ X/mês"). */
export const CYCLE_MONTHS: Record<PlanBillingCycle, number> = {
  monthly: 1,
  semestral: 6,
  annual: 12,
}

/** Total cobrado no ciclo (em centavos) para um plano. */
export function getCyclePriceCents(plan: PlanId, cycle: PlanBillingCycle): number {
  const m = PLAN_META[plan]
  if (cycle === 'semestral') return m.priceSemestralCents
  if (cycle === 'annual') return m.priceAnnualCents
  return m.priceMonthlyCents
}

/**
 * Multiplicador de consumo de crédito por modelo de IA. A Althos fornece e paga
 * o token; modelos mais caros consomem mais créditos por ação para manter o
 * custo por crédito ~constante. Baseado no PRICING de lib/ai/attendant-engine.ts.
 */
export const MODEL_CREDIT_MULTIPLIER: Record<string, number> = {
  'claude-haiku-4-5': 1,
  'gemini-1.5-flash': 1,
  'deepseek-chat': 1,
  'claude-sonnet-4-6': 3,
  'gpt-4o': 3,
  'claude-opus-4-7': 5,
  'gpt-4.1': 5,
}

/** Modelos que o cliente pode escolher (rótulo + multiplicador). */
export const SELECTABLE_AI_MODELS: { id: string; label: string; multiplier: number }[] = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku (rápido, econômico)', multiplier: 1 },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet (mais inteligente)', multiplier: 3 },
  { id: 'gpt-4o', label: 'GPT-4o (OpenAI)', multiplier: 3 },
  { id: 'gemini-1.5-flash', label: 'Gemini Flash (Google)', multiplier: 1 },
  { id: 'deepseek-chat', label: 'DeepSeek', multiplier: 1 },
]

/** Resolve o multiplicador de um modelo, default 1×. */
export function modelCreditMultiplier(model: string | null | undefined): number {
  return MODEL_CREDIT_MULTIPLIER[model ?? ''] ?? 1
}

/** Preço de venda do crédito avulso (add-on), em centavos. */
export const ADDON_CREDIT_PRICE_CENTS = 15

/** Pacotes de créditos avulsos à venda (preço unitário decrescente). */
export const CREDIT_PACKS: { credits: number; priceCents: number }[] = [
  { credits: 100, priceCents: 1500 },   // R$0,15/cr
  { credits: 500, priceCents: 7000 },   // R$0,14/cr
  { credits: 1000, priceCents: 13000 }, // R$0,13/cr
]

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
