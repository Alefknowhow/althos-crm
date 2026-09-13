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
 * (trial/starter/pro/scale/agency/internal) remains for the public
 * marketing site until it's reconciled — see docs/PRICING_ARCHITECTURE.md.
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
  | 'bulk_campaigns'
  | 'voice'

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
  'bulk_campaigns',
  'voice',
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
    bulk_campaigns: false,
    voice: false,
  },
  // Starter/Pro/Business têm as MESMAS funcionalidades desde a reprecificação
  // de set/2026 (docs/plano-precos/) — a diferença é QUANTIDADE de uso (ver
  // PLAN_LIMITS: usuários, orgs, disparos de automação/social/e-mail,
  // storage, créditos de IA) e dois recursos premium (ai_insights +
  // export_reports) reservados a Pro/Business. Antes disso, Starter também
  // tinha WhatsApp/Instagram/campanhas desligados por completo — mudou pra
  // "ligado com teto de uso" pra que o Atendente IA (que já era incluso)
  // tivesse um canal de verdade pra operar.
  // white_label foi removido da oferta (false em todos os planos).
  starter: {
    tasks: true,
    catalogo: true,
    whatsapp: true,
    capi_pixel: true,
    ai_insights: false,        // premium: só Pro/Business
    white_label: false,        // removido da oferta
    agendamentos: true,
    ai_attendant: true,
    lead_scoring: true,
    multi_tenant: false,       // 1 org (ver PLAN_LIMITS.orgs)
    export_reports: false,     // premium: só Pro/Business
    meta_ads_panel: true,
    instagram_automation: true,
    bulk_campaigns: true,
    voice: false,          // Althos Voice: só Business (repricing set/2026)
  },
  pro: {
    tasks: true,
    catalogo: true,
    whatsapp: true,
    capi_pixel: true,
    ai_insights: true,
    white_label: false,        // removido da oferta
    agendamentos: true,
    ai_attendant: true,
    lead_scoring: true,
    multi_tenant: true,        // até 5 orgs
    export_reports: true,
    meta_ads_panel: true,
    instagram_automation: true,
    bulk_campaigns: true,
    // Voice AI é diferencial exclusivo do Business na repricing set/2026
    // (docs/PRICING_ARCHITECTURE.md § 2) — antes era Pro+Business; corrigido
    // a pedido do usuário (sem clientes ativos, seguro mudar entitlement).
    voice: false,
  },
  business: {
    tasks: true,
    catalogo: true,
    whatsapp: true,
    capi_pixel: true,
    ai_insights: true,
    white_label: false,        // removido da oferta
    agendamentos: true,
    ai_attendant: true,
    lead_scoring: true,
    multi_tenant: true,        // orgs ilimitadas
    export_reports: true,
    meta_ads_panel: true,
    instagram_automation: true,
    bulk_campaigns: true,
    voice: true,
  },
}

export interface PlanMeta {
  id: PlanId
  name: string
  priceMonthlyCents: number
  priceSemestralCents: number
  priceAnnualCents: number
  aiCreditsMonthly: number
  /** Usuários inclusos no preço base do plano (migration 0244). */
  includedUsers: number
  /** Preço (centavos/mês) de cada usuário além de includedUsers. 0 = não vende assento avulso. */
  extraUserPriceCents: number
}

/**
 * Static plan metadata — mirror of the `plans` price/credit columns.
 *
 * Repricing de set/2026 (migration 0244, PRICING_ARCHITECTURE.md): nova
 * filosofia comercial — plano base da empresa + usuários incluídos/extras +
 * Althos Credits (em vez de cobrança majoritariamente por usuário). Preços:
 * Starter R$149 · Pro R$299 · Business R$599 (mensal). Semestral −10% ·
 * Anual −18% (totais pagos por ciclo, já com desconto). Substitui a
 * repricing anterior (migration 0155, R$167/397/697) — decisão de negócio
 * explícita: migrar TODAS as contas para os novos valores, sem
 * grandfathering (subscriptions.legacy_plan_id guarda o plano anterior por
 * auditoria).
 *
 * Créditos de IA mensais ("Althos Credits"): Starter 500 · Pro 2.500 ·
 * Business 7.500 — franquia fixa por plano (não é mais % do preço).
 *
 * includedUsers/extraUserPriceCents: usuário adicional além da franquia
 * custa R$39 (Starter) / R$49 (Pro) / R$59 (Business) por mês — ver
 * computeSeatCost() abaixo.
 */
export const PLAN_META: Record<PlanId, PlanMeta> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    priceSemestralCents: 0,
    priceAnnualCents: 0,
    aiCreditsMonthly: 0,
    includedUsers: 1,
    extraUserPriceCents: 0,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthlyCents: 14900,
    priceSemestralCents: 80460,
    priceAnnualCents: 146616,
    aiCreditsMonthly: 500,
    includedUsers: 2,
    extraUserPriceCents: 3900,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthlyCents: 29900,
    priceSemestralCents: 161460,
    priceAnnualCents: 294264,
    aiCreditsMonthly: 2500,
    includedUsers: 5,
    extraUserPriceCents: 4900,
  },
  business: {
    id: 'business',
    name: 'Business',
    priceMonthlyCents: 59900,
    priceSemestralCents: 323460,
    priceAnnualCents: 589656,
    aiCreditsMonthly: 7500,
    includedUsers: 10,
    extraUserPriceCents: 5900,
  },
}

// computeSeatCost()/SeatCost moved to lib/plans/seats.ts (arquivo dedicado —
// este arquivo passou do limite de 350 linhas do lint). Reexportado aqui só
// por compatibilidade com imports existentes (`from '@/lib/plans/config'`);
// prefira importar de '@/lib/plans/seats' em código novo.
export { computeSeatCost, type SeatCost } from './seats'

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
  customers: number        // registros de clientes (-1 desde a repricing — sem teto, ver storageMb)
  users: number
  leads: number            // leads no pipeline (-1 = ilimitado)
  orgs: number             // empresas/organizações por conta (multi-tenant)
  forms: number            // formulários de captação ativos
  storageMb: number        // storage de mídia (uploads, vouchers, mídia de WhatsApp/Instagram) em MB
  emailSends: number       // disparos de e-mail marketing por mês (1 e-mail = 1 disparo)
}

// Valores atualizados na repricing de set/2026 (migration 0155,
// docs/plano-precos/03-*). customers deixou de ter teto (era 500/2000 —
// vira storageMb, que é o custo elástico real). forms, socialMessages,
// storageMb e emailSends são novos/recalculados nessa mesma leva.
// `users` aqui é a franquia INCLUÍDA (espelha plans.max_users/includedUsers,
// migration 0244) — não o teto rígido de convites. O teto real de convite é
// franquia + subscriptions.extra_seats, calculado em account_user_limit()
// (SQL) e computeSeatCost() (TS) — nunca leia PLAN_LIMITS.users sozinho pra
// decidir se uma conta pode convidar mais gente.
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free:     { pipelines: 1,  automations: 0,  automationRuns: 0,     socialAccounts: 0,  socialMessages: 0,    customers: 50, users: 1,  leads: 100, orgs: 1, forms: 1,   storageMb: 0,     emailSends: 0    },
  starter:  { pipelines: 2,  automations: 5,  automationRuns: 1000,  socialAccounts: 1,  socialMessages: 500,  customers: -1, users: 2,  leads: -1,  orgs: 1, forms: 10,  storageMb: 2048,  emailSends: 300  },
  pro:      { pipelines: 5,  automations: 20, automationRuns: 10000, socialAccounts: 3,  socialMessages: 1000, customers: -1, users: 5,  leads: -1,  orgs: 5, forms: 20,  storageMb: 5120,  emailSends: 1000 },
  business: { pipelines: -1, automations: -1, automationRuns: -1,    socialAccounts: -1, socialMessages: -1,   customers: -1, users: 10, leads: -1,  orgs: -1, forms: -1, storageMb: 15360, emailSends: 5000 },
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

// Precificação de créditos por modelo/ação — movida pra ./credit-pricing.ts
// (este arquivo passou do limite de linhas do lint). Reexportada aqui só
// por compatibilidade com imports existentes.
export {
  MODEL_CREDIT_MULTIPLIER,
  SELECTABLE_AI_MODELS,
  modelCreditMultiplier,
  computeCreditCost,
  currentPeriodMonth,
  ADDON_CREDIT_PRICE_CENTS,
  CREDIT_PACKS,
  AI_CREDIT_COST,
  type AiAction,
} from './credit-pricing'

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
  bulk_campaigns: 'Campanhas de Envio',
  voice: 'Althos Voice',
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
