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
    voice: false,          // Althos Voice: só Pro/Business
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
    voice: true,
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

/**
 * Custo de usuários adicionais além da franquia do plano — "5 de 5
 * incluídos" / "7 usuários: 5 incluídos + 2 adicionais = R$98/mês".
 * Fonte central: nenhum componente deve recalcular isso com valores
 * próprios (ver seção 10 de PRICING_ARCHITECTURE.md).
 */
export interface SeatCost {
  totalUsers: number
  includedUsers: number
  extraUsers: number
  extraUserPriceCents: number
  extraCostCents: number
}

export function computeSeatCost(plan: PlanId | string | null | undefined, totalUsers: number): SeatCost {
  const meta = getPlanMeta(plan)
  const extraUsers = Math.max(0, totalUsers - meta.includedUsers)
  return {
    totalUsers,
    includedUsers: meta.includedUsers,
    extraUsers,
    extraUserPriceCents: meta.extraUserPriceCents,
    extraCostCents: extraUsers * meta.extraUserPriceCents,
  }
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

/**
 * Multiplicador de consumo de crédito por modelo de IA. A Althos fornece e paga
 * o token; modelos mais caros consomem mais créditos por ação para manter o
 * custo por crédito ~constante. Baseado no PRICING de lib/ai/attendant-engine.ts.
 */
export const MODEL_CREDIT_MULTIPLIER: Record<string, number> = {
  'claude-haiku-4-5': 1,
  'gemini-1.5-flash': 1,
  'gemini-2.5-flash': 1,
  'gemini-2.5-flash-lite': 1,
  'gemini-3.6-flash': 2,
  'gemini-3.5-flash': 2,
  'gemini-3.5-flash-lite': 1,
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

/**
 * Custo final em créditos (inteiro, sempre >= 1) — extraído de
 * consumeAiCredits (lib/plans/server.ts) pra ser testável sem mockar
 * Supabase. Fracionário arredonda pra CIMA (a tabela ai_credits é inteira;
 * arredondar pra baixo subcobraria sistematicamente).
 */
export function computeCreditCost(baseCost: number, multiplier: number): number {
  return Math.max(1, Math.ceil(baseCost * multiplier))
}

/**
 * Period key used by the ai_credits table: 'YYYY-MM' (UTC). Movida de
 * lib/plans/server.ts pra cá — é pura (sem I/O), mas morava num arquivo com
 * import de next/headers no topo, o que a deixava intestável isoladamente.
 */
export function currentPeriodMonth(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Preço de venda do crédito avulso (add-on), em centavos. */
export const ADDON_CREDIT_PRICE_CENTS = 15

/**
 * @deprecated Pacotes legados (crédito de IA em pequena escala). O catálogo
 * vigente de Althos Credits é a tabela `credit_packages` (migration 0244),
 * lido via `getCreditPackagesCatalog()` em lib/credits/engine.ts — nunca
 * hardcode pacotes/preços em componentes. Mantido só para não quebrar
 * imports existentes até a UI migrar.
 */
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
  instagram_ai_reply: 1,
  ai_insights_query: 2,
  lead_scoring: 1, // doc spec was 0.5 — rounded up to 1 because credits are integer
  generate_proposal: 3,
  // Leitura de imagem/PDF por visão (voucher, orçamento colado, etc.) — mais
  // cara que uma chamada de texto simples por causa do custo de visão do modelo.
  ocr_extract: 3,
  // Geração de roteiro com Gemini Flash 2.5 + busca na web — chamada mais
  // pesada que um OCR (grounding, prompt maior, saída longa).
  roteirista_generate: 4,
  // Chat de IA analítica do Financeiro — mesmo custo-base do copiloto da
  // Inicial (ai_insights_query), mantido separado pra métricas de uso e
  // gating de plano independentes.
  financial_ai_chat: 2,
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
