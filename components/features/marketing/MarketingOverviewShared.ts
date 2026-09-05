import type { ObjectiveGroup } from '@/lib/marketing/objective'
import { OBJECTIVE_GROUP_LABELS } from '@/lib/marketing/objective'
import type { MetricKey, MetricContext } from './metricRegistry'
import { METRIC_REGISTRY } from './metricRegistry'

export type { MetricKey, MetricContext }
import {
  Users,
  DollarSign,
  TrendingUp,
  Target,
  MousePointerClick,
  Eye,
  MessageCircle,
  Link2,
  FileText,
  ShoppingCart,
  Receipt,
} from 'lucide-react'

export type CampaignRow = {
  id: string
  name: string
  color: string | null
  status: string
  objective_group: ObjectiveGroup
  ad_account_id: string
  provider: string
  account_name: string
  spend_cents: number
  impressions: number
  clicks: number
  leads: number
  cpl_cents: number | null
  cpm_cents: number | null
  ctr: number
  meta_leads: number
  meta_messaging_started: number
  meta_link_clicks: number
  meta_landing_page_views: number
  meta_purchases: number
  meta_purchase_value_cents: number
  cost_per_conversation_cents: number | null
  won_deals: number
  revenue_cents: number
  cac_cents: number | null
  roas: number | null
}

export type TimeSeriesPoint = MetricContext & { date: string; ad_account_id: string; campaign_id: string }

export type Overview = {
  totals: { spend_cents: number; impressions: number; clicks: number; leads: number; won_deals: number; revenue_cents: number }
  campaigns: CampaignRow[]
  timeSeries: TimeSeriesPoint[]
  sourcesByLeads: Array<{ name: string; value: number }>
  byObjective: Array<{ group: ObjectiveGroup; spend_cents: number; leads: number; meta_messaging_started: number; won_deals: number; revenue_cents: number }>
  previousCampaigns: Array<{ campaign_id: string; ad_account_id: string | null; objective_group: ObjectiveGroup; spend_cents: number; impressions: number; clicks: number; meta_leads: number; meta_messaging_started: number; meta_purchases: number }>
}

export const OBJECTIVE_FILTERS: Array<{ value: ObjectiveGroup | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'leads', label: OBJECTIVE_GROUP_LABELS.leads },
  { value: 'messaging', label: OBJECTIVE_GROUP_LABELS.messaging },
  { value: 'traffic', label: OBJECTIVE_GROUP_LABELS.traffic },
  { value: 'sales', label: OBJECTIVE_GROUP_LABELS.sales },
  { value: 'awareness', label: OBJECTIVE_GROUP_LABELS.awareness },
]

export type Account = { id: string; provider: string; name: string; status: string }
export type Campaign = { id: string; name: string; ad_account_id: string; utm_campaign: string | null; color: string | null }

export type Props = {
  orgSlug: string
  period: 'today' | '7d' | '30d' | '90d' | 'mtd' | 'max' | string
  overview: Overview
  accounts: Account[]
  campaigns: Campaign[]
  /** Nome do usuário Facebook logado (via login OAuth do Meta Ads) — null se
   *  nunca conectou ou o token expirou/foi revogado do lado da Meta. */
  metaLoginUserName?: string | null
  /** Preferências de cards/gráfico salvas anteriormente (org_settings) — null
   *  na primeira vez, cai nos defaults (DEFAULT_CARD_METRICS/DEFAULT_CHART_METRICS). */
  initialMetricsPrefs?: { cardMetrics: string[]; chartMetrics: string[] } | null
}

export const PERIODS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'mtd', label: 'Mês atual' },
  { value: 'max', label: 'Máximo' },
] as const

export function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

/** 'menu' = linha dentro de um DropdownMenu — precisa parecer um item de
 *  menu (mesmo hover/alinhamento dos DropdownMenuItem simples ao lado),
 *  não um botão avulso. Sem isso os itens do menu "Gerenciar contas"
 *  ficavam com estilos inconsistentes entre si. */
export type TriggerVariant = 'default' | 'outline' | 'menu'

export function triggerButtonProps(variant: TriggerVariant) {
  if (variant === 'menu') {
    return { variant: 'ghost' as const, className: 'w-full h-auto justify-start px-2 py-1.5 font-normal' }
  }
  return { variant, size: variant === 'outline' ? ('sm' as const) : undefined }
}

export const DONUT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export const METRIC_ICONS: Record<MetricKey, any> = {
  spend: Receipt,
  impressions: Eye,
  clicks: MousePointerClick,
  leads: Users,
  cpl: DollarSign,
  ctr: Target,
  cpc: DollarSign,
  cpm: Eye,
  meta_leads: Users,
  meta_messaging_started: MessageCircle,
  meta_link_clicks: Link2,
  meta_landing_page_views: FileText,
  meta_purchases: ShoppingCart,
  cac: Target,
  roas: TrendingUp,
  cost_per_conversion: MessageCircle,
}

export const METRIC_ICON_BG: Record<MetricKey, string> = {
  spend: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  impressions: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  clicks: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  leads: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  cpl: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  ctr: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  cpc: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  cpm: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  meta_leads: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  meta_messaging_started: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  meta_link_clicks: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  meta_landing_page_views: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  meta_purchases: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  cac: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  roas: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  cost_per_conversion: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
}

/** Filtra pra só as chaves que ainda existem no registro atual — evita
 *  quebrar se uma preferência salva referenciar uma métrica removida. */
export function sanitizeMetricKeys(keys: string[] | undefined, fallback: MetricKey[]): Set<MetricKey> {
  if (!keys || keys.length === 0) return new Set(fallback)
  const valid = keys.filter((k): k is MetricKey => k in METRIC_REGISTRY)
  return valid.length > 0 ? new Set(valid) : new Set(fallback)
}
