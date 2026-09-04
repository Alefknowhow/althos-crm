import { createClient } from '@/lib/supabase/server'
import { fetchNormalizedSales } from '@/lib/dashboard/sales-source'
import { getDates, type Period } from './dashboard-core'

/**
 * Configurable metric time-series (the main dashboard chart) and the
 * revenue-vs-commission series. Split out of actions/dashboard.ts.
 */

// ── Configurable metric time-series ──────────────────────────────────────────
// Powers the main dashboard chart where the user picks WHICH indicator to plot
// (new leads, revenue, sales count, appointments). Returns a continuous,
// zero-filled daily series so the line never has gaps.

export type DashboardMetric = 'leads' | 'revenue' | 'sales' | 'appointments'

export const DASHBOARD_METRICS: {
  value: DashboardMetric
  label: string
  color: string
  format: 'number' | 'currency'
}[] = [
  { value: 'leads',        label: 'Novos leads',  color: '#0f62fe', format: 'number' },
  { value: 'revenue',      label: 'Receita',      color: '#24a148', format: 'currency' },
  { value: 'sales',        label: 'Vendas',       color: '#8a3ffc', format: 'number' },
  { value: 'appointments', label: 'Agendamentos', color: '#ee5396', format: 'number' },
]

export type MetricSeries = {
  metric: DashboardMetric
  label: string
  color: string
  format: 'number' | 'currency'
  total: number
  points: { date: string; value: number }[]
}

function dayKeyUTC(input: string | Date): string {
  const d = typeof input === 'string'
    ? new Date(input.length === 10 ? `${input}T00:00:00Z` : input)
    : input
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

export async function getMetricTimeSeries(
  orgId: string,
  period: Period = '30d',
  metric: DashboardMetric = 'leads',
  pipelineId?: string | null,
  sellerId?: string | null,
): Promise<MetricSeries> {
  const supabase = createClient()
  const { start, now } = getDates(period)
  const meta = DASHBOARD_METRICS.find(m => m.value === metric) ?? DASHBOARD_METRICS[0]

  // Continuous, zero-filled day buckets (UTC) so the chart axis has no gaps.
  const buckets: Record<string, number> = {}
  const order: string[] = []
  const startUTC = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const endUTC   = new Date(Date.UTC(now.getUTCFullYear(),   now.getUTCMonth(),   now.getUTCDate()))
  for (let d = new Date(startUTC); d <= endUTC; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = dayKeyUTC(new Date(d))
    if (!(key in buckets)) { buckets[key] = 0; order.push(key) }
  }

  function add(ts: string | null, amount: number) {
    if (!ts) return
    const key = dayKeyUTC(ts)
    if (key in buckets) buckets[key] += amount
  }

  if (metric === 'leads') {
    let q = supabase
      .from('contatos')
      .select('created_at')
      .eq('organization_id', orgId)
      .gte('created_at', start.toISOString())
    if (pipelineId) q = q.eq('pipeline_id', pipelineId)
    if (sellerId) q = q.eq('assigned_to', sellerId)
    const { data } = await q
    ;(data ?? []).forEach((r: any) => add(r.created_at, 1))
  } else if (metric === 'revenue' || metric === 'sales') {
    // Niche-aware: travel orgs read from travel_sales, others from sales.
    const rows = await fetchNormalizedSales(supabase, orgId, { since: start })
    rows
      .filter(r => !sellerId || r.seller_id === sellerId)
      .forEach(r => add(r.date, metric === 'revenue' ? (r.amount_cents || 0) / 100 : 1))
  } else if (metric === 'appointments') {
    const { data } = await supabase
      .from('appointments')
      .select('start_time, status')
      .eq('organization_id', orgId)
      .neq('status', 'canceled')
      .gte('start_time', start.toISOString())
    ;(data ?? []).forEach((r: any) => add(r.start_time, 1))
  }

  const points = order.map(date => ({ date, value: buckets[date] }))
  const total  = points.reduce((acc, p) => acc + p.value, 0)

  return {
    metric,
    label:  meta.label,
    color:  meta.color,
    format: meta.format,
    total,
    points,
  }
}

export type RevenueCommissionPoint = { date: string; revenue_cents: number; commission_cents: number }

/**
 * Receita e comissão ACUMULADAS dia a dia no período — alimenta o gráfico
 * "Receita x Comissão" da Inicial. Comissão só existe pro nicho viagens
 * (fetchNormalizedSales já retorna 0 pros demais nichos), então o valor
 * fica achatado em zero fora desse nicho — o front decide se esconde a
 * linha.
 */
export async function getRevenueCommissionSeries(
  orgId: string,
  period: Period = '30d',
  sellerId?: string | null,
): Promise<{ points: RevenueCommissionPoint[]; hasCommission: boolean }> {
  const supabase = createClient()
  const { start, now } = getDates(period)

  const buckets: Record<string, { revenue_cents: number; commission_cents: number }> = {}
  const order: string[] = []
  const startUTC = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const endUTC   = new Date(Date.UTC(now.getUTCFullYear(),   now.getUTCMonth(),   now.getUTCDate()))
  for (let d = new Date(startUTC); d <= endUTC; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = dayKeyUTC(new Date(d))
    if (!(key in buckets)) { buckets[key] = { revenue_cents: 0, commission_cents: 0 }; order.push(key) }
  }

  const rows = await fetchNormalizedSales(supabase, orgId, { since: start })
  let hasCommission = false
  for (const r of rows.filter(r => !sellerId || r.seller_id === sellerId)) {
    const key = dayKeyUTC(r.date)
    if (!(key in buckets)) continue
    buckets[key].revenue_cents += r.amount_cents
    buckets[key].commission_cents += r.commission_cents
    if (r.commission_cents > 0) hasCommission = true
  }

  let revAcc = 0
  let commAcc = 0
  const points = order.map(date => {
    revAcc += buckets[date].revenue_cents
    commAcc += buckets[date].commission_cents
    return { date, revenue_cents: revAcc, commission_cents: commAcc }
  })

  return { points, hasCommission }
}