/**
 * AI Analyst tools -- generic business metrics (KPIs, sales, pipeline,
 * forecast, appointments, marketing). Split out of insights-tools.ts.
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

export async function queryPipeline(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { getAdvancedFunnel } = await import('@/actions/dashboard')
  const periodo = (input.periodo as string) || '30d'
  const result = await getAdvancedFunnel(ctx.orgId, {
    period: periodo as any,
    source: { kind: 'all' },
    pipelineId: input.pipeline_id || null,
  })

  if (result.stages.length === 0) {
    return { summary: 'Nenhum estágio de pipeline configurado.', view: { type: 'none' } }
  }

  return {
    summary: `${result.total_leads} leads no funil, conversão geral de ${result.overall_conversion_pct.toFixed(1)}% (do 1º ao último estágio), valor agregado ${fmtCurrency(result.total_value_cents)}. Por estágio: ${result.stages.map(s => `${s.name} — ${s.count} leads (${s.conversion_from_previous.toFixed(0)}% do estágio anterior)`).join('; ')}.`,
    view: {
      type: 'table',
      columns: ['Estágio', 'Leads', 'Valor', 'Conversão do anterior'],
      rows: result.stages.map(s => [s.name, String(s.count), fmtCurrency(s.value_cents), `${s.conversion_from_previous.toFixed(0)}%`]),
    },
  }
}

export async function queryForecast(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { getRevenueForecast } = await import('@/actions/dashboard')
  const forecast = await getRevenueForecast(ctx.orgId, { pipelineId: input.pipeline_id || null })

  if (forecast.stages.length === 0 && forecast.already_won_cents === 0) {
    return { summary: 'Sem dados suficientes no pipeline para projetar receita.', view: { type: 'none' } }
  }

  const items = [
    { label: 'Já ganho (mês)', value: fmtCurrency(forecast.already_won_cents) },
    { label: 'Esperado do pipeline', value: fmtCurrency(forecast.total_expected_cents) },
    { label: 'Projeção combinada', value: fmtCurrency(forecast.combined_forecast_cents) },
  ]

  const byStage = forecast.stages
    .map(s => `${s.stage_name} (${(s.probability * 100).toFixed(0)}% de ${s.lead_count} leads)`)
    .join(', ')

  return {
    summary: `Forecast do mês: já ganho ${fmtCurrency(forecast.already_won_cents)} + esperado do pipeline ${fmtCurrency(forecast.total_expected_cents)} = projeção combinada de ${fmtCurrency(forecast.combined_forecast_cents)}.${byStage ? ` Por estágio: ${byStage}.` : ''}`,
    view: { type: 'kpis', items },
  }
}

export async function queryAppointments(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('appointments')
    .select('status')
    .eq('organization_id', ctx.orgId)
    .gte('start_time', start.toISOString())

  if (!data || data.length === 0) {
    return { summary: `Sem agendamentos no período (${label}).`, view: { type: 'none' } }
  }

  const counts = new Map<string, number>()
  for (const a of data) counts.set(a.status, (counts.get(a.status) || 0) + 1)

  const STATUS_LABEL: Record<string, string> = {
    scheduled: 'Agendados',
    completed: 'Concluídos',
    canceled: 'Cancelados',
  }

  const pieData = Array.from(counts.entries()).map(([k, v]) => ({
    name: STATUS_LABEL[k] || k,
    value: v,
  }))

  const total = data.length
  const completed = counts.get('completed') || 0
  const canceled = counts.get('canceled') || 0
  const noShowRate = total > 0 ? (canceled / total) * 100 : 0

  return {
    summary: `${total} agendamentos no período (${label}): ${completed} concluídos, ${counts.get('scheduled') || 0} marcados, ${canceled} cancelados. Taxa de cancelamento: ${noShowRate.toFixed(1)}%.`,
    view: { type: 'pie', data: pieData },
  }
}

export async function queryMarketing(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)

  const { data: campaigns } = await ctx.supabase
    .from('campaigns')
    .select('id, name, utm_campaign')
    .eq('organization_id', ctx.orgId)

  if (!campaigns || campaigns.length === 0) {
    return { summary: 'Sem campanhas cadastradas.', view: { type: 'none' } }
  }

  const campaignIds = campaigns.map(c => c.id)
  const [{ data: metrics }, { data: subs }] = await Promise.all([
    ctx.supabase
      .from('campaign_metrics_daily')
      .select('campaign_id, spend_cents')
      .in('campaign_id', campaignIds)
      .eq('organization_id', ctx.orgId)
      .gte('date', start.toISOString().slice(0, 10)),
    ctx.supabase
      .from('form_submissions')
      .select('utm_campaign')
      .gte('created_at', start.toISOString())
      .not('utm_campaign', 'is', null),
  ])

  const spendByCampaign = new Map<string, number>()
  for (const m of metrics || [])
    spendByCampaign.set(m.campaign_id, (spendByCampaign.get(m.campaign_id) || 0) + (m.spend_cents || 0))

  const leadsByUtm = new Map<string, number>()
  for (const s of subs || []) {
    const k = String(s.utm_campaign || '').toLowerCase().trim()
    if (!k) continue
    leadsByUtm.set(k, (leadsByUtm.get(k) || 0) + 1)
  }

  const rows = campaigns
    .map(c => {
      const spend = spendByCampaign.get(c.id) || 0
      const leads = c.utm_campaign ? leadsByUtm.get(c.utm_campaign.toLowerCase().trim()) || 0 : 0
      const cpl = leads > 0 ? spend / leads : 0
      return {
        name: c.name,
        spend,
        leads,
        cpl,
      }
    })
    .filter(r => r.spend > 0 || r.leads > 0)
    .sort((a, b) => b.spend - a.spend)

  if (rows.length === 0) {
    return {
      summary: `Sem dados de marketing no período (${label}).`,
      view: { type: 'none' },
    }
  }

  const totalSpend = rows.reduce((a, r) => a + r.spend, 0)
  const totalLeads = rows.reduce((a, r) => a + r.leads, 0)

  return {
    summary: `${rows.length} campanhas ativas no período (${label}). Total investido: ${fmtCurrency(totalSpend)}, ${totalLeads} leads atribuídos, CPL médio ${fmtCurrency(totalLeads > 0 ? totalSpend / totalLeads : 0)}.`,
    view: {
      type: 'table',
      columns: ['Campanha', 'Investimento', 'Leads', 'CPL'],
      rows: rows
        .slice(0, 15)
        .map(r => [r.name, fmtCurrency(r.spend), String(r.leads), r.cpl > 0 ? fmtCurrency(r.cpl) : '—']),
    },
  }
}

