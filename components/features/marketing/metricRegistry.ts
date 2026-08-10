/**
 * Fonte única de verdade pras métricas selecionáveis no painel de
 * Marketing — usada tanto pelos KPI cards (via totais agregados) quanto
 * pelo gráfico de evolução (via pontos diários). Os dois consumidores
 * passam objetos com o mesmo formato de campos (`MetricContext`), então
 * um único `extract()` por métrica serve pras duas coisas.
 */

export type MetricKey =
  | 'spend' | 'impressions' | 'clicks' | 'leads' | 'cpl' | 'ctr' | 'cpc'
  | 'meta_leads' | 'meta_messaging_started' | 'meta_link_clicks' | 'meta_landing_page_views' | 'meta_purchases'
  | 'cac' | 'roas'

export type MetricContext = {
  spend_cents: number
  impressions: number
  clicks: number
  leads: number
  meta_leads: number
  meta_messaging_started: number
  meta_link_clicks: number
  meta_landing_page_views: number
  meta_purchases: number
  meta_purchase_value_cents: number
  won_deals: number
  revenue_cents: number
}

export type MetricDef = {
  label: string
  color: string
  format: (v: number) => string
  /** Se false, a métrica não aparece na lista de seleção do gráfico (ex:
   * CAC/ROAS não são deriváveis por dia sem join de negócios ganhos por
   * dia — só fazem sentido como total do período, nos cards). */
  chartable: boolean
  axis: 'left' | 'right'
  type: 'area' | 'line'
  extract: (ctx: MetricContext) => number
}

const currency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const number = (v: number) => new Intl.NumberFormat('pt-BR').format(v)

export const METRIC_REGISTRY: Record<MetricKey, MetricDef> = {
  spend: {
    label: 'Investimento', color: '#3b82f6', format: currency, chartable: true, axis: 'left', type: 'area',
    extract: c => c.spend_cents / 100,
  },
  impressions: {
    label: 'Impressões', color: '#a855f7', format: number, chartable: true, axis: 'right', type: 'line',
    extract: c => c.impressions,
  },
  clicks: {
    label: 'Cliques', color: '#ec4899', format: number, chartable: true, axis: 'right', type: 'line',
    extract: c => c.clicks,
  },
  leads: {
    label: 'Leads', color: '#10b981', format: number, chartable: true, axis: 'right', type: 'line',
    extract: c => c.leads,
  },
  cpl: {
    label: 'CPL', color: '#f59e0b', format: currency, chartable: true, axis: 'left', type: 'line',
    extract: c => (c.leads > 0 ? c.spend_cents / 100 / c.leads : 0),
  },
  ctr: {
    label: 'CTR (%)', color: '#06b6d4', format: v => `${v.toFixed(2)}%`, chartable: true, axis: 'right', type: 'line',
    extract: c => (c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0),
  },
  cpc: {
    label: 'CPC médio', color: '#0ea5e9', format: currency, chartable: true, axis: 'left', type: 'line',
    extract: c => (c.clicks > 0 ? c.spend_cents / 100 / c.clicks : 0),
  },
  meta_leads: {
    label: 'Leads (Meta)', color: '#22c55e', format: number, chartable: true, axis: 'right', type: 'line',
    extract: c => c.meta_leads,
  },
  meta_messaging_started: {
    label: 'Conversas iniciadas', color: '#14b8a6', format: number, chartable: true, axis: 'right', type: 'line',
    extract: c => c.meta_messaging_started,
  },
  meta_link_clicks: {
    label: 'Cliques em link', color: '#6366f1', format: number, chartable: true, axis: 'right', type: 'line',
    extract: c => c.meta_link_clicks,
  },
  meta_landing_page_views: {
    label: 'Visitas à página', color: '#8b5cf6', format: number, chartable: true, axis: 'right', type: 'line',
    extract: c => c.meta_landing_page_views,
  },
  meta_purchases: {
    label: 'Compras', color: '#f97316', format: number, chartable: true, axis: 'right', type: 'line',
    extract: c => c.meta_purchases,
  },
  cac: {
    label: 'CAC', color: '#ef4444', format: currency, chartable: false, axis: 'left', type: 'line',
    extract: c => (c.won_deals > 0 ? c.spend_cents / 100 / c.won_deals : 0),
  },
  roas: {
    label: 'ROAS', color: '#84cc16', format: v => `${v.toFixed(2)}x`, chartable: false, axis: 'left', type: 'line',
    extract: c => (c.spend_cents > 0 ? c.revenue_cents / c.spend_cents : 0),
  },
}

export const DEFAULT_CARD_METRICS: MetricKey[] = ['leads', 'cpl', 'spend', 'impressions', 'clicks', 'cpc', 'cac', 'roas']
export const DEFAULT_CHART_METRICS: MetricKey[] = ['spend', 'leads']
export const MAX_CARD_METRICS = 8
