/**
 * AI Analyst tools -- real estate vertical (imóveis, visitas,
 * negociações). Split out of insights-tools.ts.
 */

import type { AnalyticsContext, AnalyticsResult } from './insights-tools-definitions'
import { periodWindow, fmtCurrency } from './insights-tools-helpers'

/* ------- Vertical Imobiliárias ------- */

export async function queryProperties(_input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { data } = await ctx.supabase
    .from('properties')
    .select('status, purpose, price_cents')
    .eq('organization_id', ctx.orgId)

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum imóvel cadastrado.', view: { type: 'none' } }
  }

  const byStatus = new Map<string, number>()
  for (const r of rows) byStatus.set(r.status || 'sem status', (byStatus.get(r.status || 'sem status') || 0) + 1)
  const pieData = Array.from(byStatus.entries()).map(([name, value]) => ({ name, value }))

  const priced = rows.map(r => r.price_cents || 0).filter(p => p > 0)
  const avgPrice = priced.length > 0 ? priced.reduce((a, p) => a + p, 0) / priced.length : 0

  return {
    summary: `${rows.length} imóveis no portfólio. Distribuição por status: ${Array.from(byStatus.entries()).map(([k, v]) => `${k}: ${v}`).join(', ')}. Preço médio: ${fmtCurrency(avgPrice)}.`,
    view: { type: 'pie', data: pieData },
  }
}

export async function queryVisits(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('property_visits')
    .select('status, broker_user_id')
    .eq('organization_id', ctx.orgId)
    .gte('scheduled_at', start.toISOString())

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma visita agendada no período (${label}).`, view: { type: 'none' } }
  }

  const byBroker = new Map<string, number>()
  for (const r of rows) {
    const k = r.broker_user_id || 'Sem corretor'
    byBroker.set(k, (byBroker.get(k) || 0) + 1)
  }
  const barData = Array.from(byBroker.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const done = rows.filter(r => r.status === 'realizada' || r.status === 'done').length
  const canceled = rows.filter(r => r.status === 'cancelada' || r.status === 'canceled').length

  return {
    summary: `${rows.length} visitas no período (${label}): ${done} realizadas, ${canceled} canceladas.`,
    view: { type: 'bar', data: barData, color: '#0ea5e9' },
  }
}

export async function queryDeals(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('property_deals')
    .select('deal_type, final_price_cents, commission_cents, monthly_rent_cents, status, closed_at, contatos(name), properties(title)')
    .eq('organization_id', ctx.orgId)
    .gte('closed_at', start.toISOString())
    .order('closed_at', { ascending: false })

  const rows = ((data as any[]) || []).filter(r => r.status !== 'cancelado')
  if (rows.length === 0) {
    return { summary: `Nenhuma negociação fechada no período (${label}).`, view: { type: 'none' } }
  }

  const totalValue = rows.reduce((a, r) => a + (r.final_price_cents || r.monthly_rent_cents || 0), 0)
  const totalCommission = rows.reduce((a, r) => a + (r.commission_cents || 0), 0)
  const sales = rows.filter(r => r.deal_type === 'venda').length
  const rentals = rows.filter(r => r.deal_type === 'locacao').length

  // Lista de clientes/imóveis vai só no texto — sem isso a IA não consegue
  // responder "quem foi o cliente da negociação mais recente".
  const recentList = rows.slice(0, 10).map((r: any) => `${r.contatos?.name || 'Cliente removido'} — ${r.properties?.title || 'imóvel removido'} (${fmtCurrency(r.final_price_cents || r.monthly_rent_cents || 0)}, ${new Date(r.closed_at).toLocaleDateString('pt-BR')})`).join('; ')

  const items = [
    { label: 'Negociações fechadas', value: String(rows.length) },
    { label: 'Vendas', value: String(sales) },
    { label: 'Locações', value: String(rentals) },
    { label: 'Valor total', value: fmtCurrency(totalValue) },
    { label: 'Comissão total', value: fmtCurrency(totalCommission) },
  ]

  return {
    summary: `${rows.length} negociações fechadas no período (${label}): ${sales} vendas, ${rentals} locações, valor total ${fmtCurrency(totalValue)}, comissão ${fmtCurrency(totalCommission)}. Mais recentes: ${recentList}.`,
    view: { type: 'kpis', items },
  }
}
