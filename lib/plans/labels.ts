/**
 * Feature labels e helpers de leitura do catálogo de planos — movidos pra cá
 * (config.ts passou do limite de 350 linhas do lint). Reexportados em
 * config.ts só por compatibilidade com imports existentes.
 */
import { PLAN_FEATURES, PLAN_IDS, PLAN_META, type FeatureKey, type PlanId, type PlanMeta } from './config'

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
  sales_coach: 'IA Sales Coach',
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
