/**
 * AI Analyst tools -- KPIs and sales breakdowns. Split out of
 * insights-tools-metrics.ts.
 */

import { fetchNormalizedSales, isOrgTravelNiche } from '@/lib/dashboard/sales-source'
import type { AnalyticsContext, AnalyticsResult } from './insights-tools-definitions'
import { periodWindow, fmtCurrency, pctChange } from './insights-tools-helpers'

export async function queryKpis(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, prevStart, prevEnd, label } = periodWindow(input.periodo)
  const supabase = ctx.supabase

  // New leads + appointments (current + previous period).
  const [
    { count: leadsCur },
    { count: leadsPrev },
    { count: apptCur },
    { count: apptPrev },
  ] = await Promise.all([
    supabase
      .from('contatos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .gte('created_at', start.toISOString()),
    supabase
      .from('contatos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .gte('created_at', prevStart.toISOString())
      .lt('created_at', prevEnd.toISOString()),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .neq('status', 'canceled')
      .gte('start_time', start.toISOString()),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .neq('status', 'canceled')
      .gte('start_time', prevStart.toISOString())
      .lt('start_time', prevEnd.toISOString()),
  ])

  // Niche-aware sales (travel orgs → travel_sales). Fetch since prevStart and
  // split into current/previous windows client-side.
  const salesRows = await fetchNormalizedSales(supabase as any, ctx.orgId, {
    since: prevStart,
    onlyCompleted: true,
  })
  const inWindow = (d: string, s: Date, e?: Date) => {
    const t = new Date(d).getTime()
    return t >= s.getTime() && (!e || t < e.getTime())
  }
  const salesCur = salesRows.filter(r => inWindow(r.date, start))
  const salesPrev = salesRows.filter(r => inWindow(r.date, prevStart, prevEnd))

  const revenueCur = salesCur.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const revenuePrev = salesPrev.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const salesCount = salesCur.length
  const ticketMedio = salesCount > 0 ? revenueCur / salesCount : 0
  const conversao = leadsCur && leadsCur > 0 ? (salesCount / leadsCur) * 100 : 0

  const items = [
    {
      label: 'Novos leads',
      value: String(leadsCur || 0),
      delta: pctChange(leadsCur || 0, leadsPrev || 0),
      deltaLabel: 'vs. período anterior',
    },
    {
      label: 'Vendas',
      value: String(salesCount),
      delta: pctChange(salesCount, (salesPrev || []).length),
    },
    {
      label: 'Faturamento',
      value: fmtCurrency(revenueCur),
      delta: pctChange(revenueCur, revenuePrev),
    },
    {
      label: 'Ticket médio',
      value: fmtCurrency(ticketMedio),
    },
    {
      label: 'Conversão',
      value: `${conversao.toFixed(1)}%`,
    },
    {
      label: 'Agendamentos',
      value: String(apptCur || 0),
      delta: pctChange(apptCur || 0, apptPrev || 0),
    },
  ]

  const summary = `KPIs do período (${label}): ${leadsCur || 0} novos leads (${pctChange(leadsCur || 0, leadsPrev || 0).toFixed(1)}% vs. anterior), ${salesCount} vendas totalizando ${fmtCurrency(revenueCur)}, ticket médio ${fmtCurrency(ticketMedio)}, conversão de ${conversao.toFixed(1)}%, ${apptCur || 0} agendamentos.`

  return { summary, view: { type: 'kpis', items } }
}

export async function querySales(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const groupBy: string = input.agrupar_por || (((input.periodo as string) || '30d') === '7d' ? 'dia' : 'mes')

  // Niche-aware: travel orgs record sales in travel_sales (no product dimension).
  if (await isOrgTravelNiche(ctx.supabase as any, ctx.orgId)) {
    const rows = await fetchNormalizedSales(ctx.supabase as any, ctx.orgId, { since: start })
    if (rows.length === 0) {
      return { summary: `Sem vendas registradas no período (${label}).`, view: { type: 'none' } }
    }

    if (groupBy === 'dia' || groupBy === 'mes') {
      const bucketKey = (d: string) => (groupBy === 'dia' ? d.slice(0, 10) : d.slice(0, 7))
      const bucketed = new Map<string, number>()
      for (const r of rows) bucketed.set(bucketKey(r.date), (bucketed.get(bucketKey(r.date)) || 0) + (r.amount_cents || 0))
      const seriesData = Array.from(bucketed.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date, total }))
      const total = seriesData.reduce((a, p) => a + p.total, 0)
      return {
        summary: `${rows.length} vendas de viagem no período (${label}), totalizando ${fmtCurrency(total)}, agrupadas por ${groupBy}.`,
        view: {
          type: 'time_series',
          data: seriesData,
          series: [{ key: 'total', label: 'Vendas (R$)', color: '#3b82f6' }],
        },
      }
    }

    if (groupBy === 'produto') {
      const total = rows.reduce((a, r) => a + (r.amount_cents || 0), 0)
      return {
        summary: `Vendas de viagem não são agrupadas por produto. Total no período (${label}): ${rows.length} vendas, ${fmtCurrency(total)}.`,
        view: { type: 'none' },
      }
    }

    // vendedor
    const bucketed = new Map<string, number>()
    for (const r of rows) {
      const k = r.seller_id || 'Sem vendedor'
      bucketed.set(k, (bucketed.get(k) || 0) + (r.amount_cents || 0))
    }
    const data = Array.from(bucketed.entries())
      .map(([name, cents]) => ({ name, value: Math.round(cents / 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
    return {
      summary: `Top ${data.length} vendedores por faturamento de viagens no período (${label}).`,
      view: { type: 'bar', data, color: '#10b981' },
    }
  }

  const { data: sales } = await ctx.supabase
    .from('sales')
    .select('sale_date, amount_cents, product_id, seller_id, products(name)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'completed')
    .gte('sale_date', start.toISOString().slice(0, 10))
    .order('sale_date', { ascending: true })

  if (!sales || sales.length === 0) {
    return {
      summary: `Sem vendas registradas no período (${label}).`,
      view: { type: 'none' },
    }
  }

  // Time series (dia/mês)
  if (groupBy === 'dia' || groupBy === 'mes') {
    const bucketKey = (d: string) =>
      groupBy === 'dia' ? d : d.slice(0, 7) // YYYY-MM
    const bucketed = new Map<string, number>()
    for (const s of sales) {
      const key = bucketKey(s.sale_date)
      bucketed.set(key, (bucketed.get(key) || 0) + (s.amount_cents || 0))
    }
    const seriesData = Array.from(bucketed.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }))
    const total = seriesData.reduce((a, p) => a + p.total, 0)
    return {
      summary: `${sales.length} vendas no período (${label}), totalizando ${fmtCurrency(total)}, agrupadas por ${groupBy}.`,
      view: {
        type: 'time_series',
        data: seriesData,
        series: [{ key: 'total', label: 'Vendas (R$)', color: '#3b82f6' }],
      },
    }
  }

  // Bar chart (produto/vendedor)
  const dimension = groupBy === 'produto' ? 'product' : 'seller'
  const bucketed = new Map<string, number>()
  for (const s of sales) {
    const key =
      dimension === 'product'
        ? ((Array.isArray(s.products) ? s.products[0]?.name : (s.products as any)?.name) ||
          'Sem produto')
        : s.seller_id || 'Sem vendedor'
    bucketed.set(key, (bucketed.get(key) || 0) + (s.amount_cents || 0))
  }
  const data = Array.from(bucketed.entries())
    .map(([name, cents]) => ({ name, value: Math.round(cents / 100) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
  return {
    summary: `Top ${data.length} ${dimension === 'product' ? 'produtos' : 'vendedores'} por faturamento no período (${label}).`,
    view: { type: 'bar', data, color: '#10b981' },
  }
}
