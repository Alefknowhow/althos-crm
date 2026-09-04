/**
 * AI Analyst tools -- pipeline, forecast, appointments, marketing.
 * Split out of insights-tools.ts. KPIs/sales split further into
 * insights-tools-metrics-sales.ts.
 */

import type { AnalyticsContext, AnalyticsResult } from './insights-tools-definitions'
import { periodWindow, fmtCurrency } from './insights-tools-helpers'

export { queryKpis, querySales } from './insights-tools-metrics-sales'

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
