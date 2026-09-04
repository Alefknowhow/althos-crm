/**
 * AI Analyst tools -- clinic vertical (atendimentos, comissões,
 * procedimentos, tratamentos, estoque). Split out of insights-tools.ts.
 * Operational/commercial data only -- never clinical record content.
 */

import type { AnalyticsContext, AnalyticsResult } from './insights-tools-definitions'
import { periodWindow, fmtCurrency } from './insights-tools-helpers'

/* ------- Vertical Clínicas — só dado operacional/comercial, nunca
 * conteúdo clínico das observações de texto livre (ver docs/audit/
 * clinicas-lgpd.md). ------- */

export async function queryClinicAttendances(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)

  const [{ data: attendances }, { data: statusRows }] = await Promise.all([
    ctx.supabase
      .from('clinic_attendances')
      .select('professional_id, attended_at, total_cents, clinic_professionals(name), contatos(name)')
      .eq('organization_id', ctx.orgId)
      .gte('attended_at', start.toISOString())
      .order('attended_at', { ascending: false }),
    ctx.supabase
      .from('clinic_appointment_context')
      .select('clinic_status')
      .eq('organization_id', ctx.orgId)
      .gte('created_at', start.toISOString())
      .in('clinic_status', ['realizado', 'no_show']),
  ])

  const rows = (attendances as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhum atendimento registrado no período (${label}).`, view: { type: 'none' } }
  }

  const byProf = new Map<string, number>()
  for (const a of rows) {
    const name = a.clinic_professionals?.name || 'Sem profissional'
    byProf.set(name, (byProf.get(name) || 0) + 1)
  }
  const barData = Array.from(byProf.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const total = (statusRows || []).length
  const noShow = (statusRows || []).filter((r: any) => r.clinic_status === 'no_show').length
  const noShowRate = total > 0 ? (noShow / total) * 100 : null

  // Lista de pacientes atendidos vai só no texto (nome é dado operacional
  // permitido pela regra do prompt — só o conteúdo clínico de texto livre é
  // vedado). Sem isso a IA não consegue responder "quem foi o último
  // paciente atendido".
  const recentList = rows.slice(0, 10).map((a: any) => `${a.contatos?.name || 'Paciente removido'} (${a.clinic_professionals?.name || 'sem profissional'}, ${new Date(a.attended_at).toLocaleDateString('pt-BR')})`).join('; ')

  return {
    summary: `${rows.length} atendimentos no período (${label}).${noShowRate !== null ? ` Taxa de no-show: ${noShowRate.toFixed(1)}%.` : ''} Por profissional: ${barData.map(b => `${b.name} (${b.value})`).join(', ')}. Mais recentes: ${recentList}.`,
    view: { type: 'bar', data: barData, color: '#0ea5e9' },
  }
}

export async function queryClinicCommissions(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)

  const { data } = await ctx.supabase
    .from('clinic_commissions')
    .select('commission_cents, status, clinic_professionals(name)')
    .eq('organization_id', ctx.orgId)
    .gte('competencia', start.toISOString().slice(0, 10))

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma comissão calculada no período (${label}).`, view: { type: 'none' } }
  }

  const pendingCents = rows.filter(r => r.status === 'pendente').reduce((a, r) => a + r.commission_cents, 0)
  const paidCents = rows.filter(r => r.status === 'pago').reduce((a, r) => a + r.commission_cents, 0)

  const byProf = new Map<string, number>()
  for (const r of rows) {
    const name = r.clinic_professionals?.name || 'Sem profissional'
    byProf.set(name, (byProf.get(name) || 0) + r.commission_cents)
  }
  const barData = Array.from(byProf.entries())
    .map(([name, cents]) => ({ name, value: Math.round(cents / 100) }))
    .sort((a, b) => b.value - a.value)

  return {
    summary: `Comissões no período (${label}): ${fmtCurrency(pendingCents)} pendentes e ${fmtCurrency(paidCents)} pagas. Por profissional: ${barData.map(b => `${b.name} (${fmtCurrency(b.value * 100)})`).join(', ')}.`,
    view: { type: 'bar', data: barData, color: '#10b981' },
  }
}

export async function queryProcedures(_input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { data: eventTypes } = await ctx.supabase
    .from('event_types')
    .select('id, name, is_active')
    .eq('organization_id', ctx.orgId)

  const rows = (eventTypes as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum procedimento cadastrado.', view: { type: 'none' } }
  }

  const { data: ctxRows } = await ctx.supabase
    .from('clinic_service_context')
    .select('event_type_id, price_cents')
    .eq('organization_id', ctx.orgId)

  const priceByEventType = new Map<string, number>()
  for (const c of (ctxRows as any[]) || []) priceByEventType.set(c.event_type_id, c.price_cents || 0)

  const active = rows.filter(r => r.is_active).length
  const priced = rows.map(r => priceByEventType.get(r.id) || 0).filter(p => p > 0)
  const avgPrice = priced.length > 0 ? priced.reduce((a, p) => a + p, 0) / priced.length : 0

  return {
    summary: `${rows.length} procedimentos cadastrados, ${active} ativos. Preço médio: ${fmtCurrency(avgPrice)}.`,
    view: {
      type: 'table',
      columns: ['Procedimento', 'Status', 'Preço'],
      rows: rows.map(r => [r.name, r.is_active ? 'Ativo' : 'Pausado', priceByEventType.get(r.id) ? fmtCurrency(priceByEventType.get(r.id)!) : '—']),
    },
  }
}

export async function queryTreatments(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('clinic_packages')
    .select('name, total_sessions, sessions_used, value_cents, status, valid_until')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhum tratamento/pacote vendido no período (${label}).`, view: { type: 'none' } }
  }

  const active = rows.filter(r => r.status === 'ativo' || r.status === 'active').length
  const totalValue = rows.reduce((a, r) => a + (r.value_cents || 0), 0)
  const soon = new Date()
  soon.setDate(soon.getDate() + 15)
  const expiringSoon = rows.filter(r => r.valid_until && new Date(r.valid_until) <= soon && new Date(r.valid_until) >= new Date()).length

  const items = [
    { label: 'Pacotes vendidos', value: String(rows.length) },
    { label: 'Ativos', value: String(active) },
    { label: 'Valor total', value: fmtCurrency(totalValue) },
    { label: 'Vencendo em 15 dias', value: String(expiringSoon) },
  ]

  return {
    summary: `${rows.length} tratamentos/pacotes no período (${label}), ${active} ativos, valor total ${fmtCurrency(totalValue)}. ${expiringSoon} vencendo nos próximos 15 dias.`,
    view: { type: 'kpis', items },
  }
}

export async function queryStock(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)

  const { data: supplies } = await ctx.supabase
    .from('clinic_supplies')
    .select('id, name, unit, quantity_in_stock, min_stock_alert, last_unit_cost_cents')
    .eq('organization_id', ctx.orgId)
    .eq('active', true)

  const rows = (supplies as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum insumo cadastrado no estoque.', view: { type: 'none' } }
  }

  let totalValueCents = 0
  const lowStock: string[] = []
  for (const s of rows) {
    totalValueCents += Math.round(Number(s.quantity_in_stock) * (s.last_unit_cost_cents || 0))
    if (s.min_stock_alert != null && Number(s.quantity_in_stock) <= Number(s.min_stock_alert)) lowStock.push(s.name)
  }

  const { data: consumption } = await ctx.supabase
    .from('clinic_supply_consumption_log')
    .select('quantity, supply_id, clinic_supplies(name, unit)')
    .eq('organization_id', ctx.orgId)
    .eq('source', 'atendimento')
    .gte('consumed_at', start.toISOString())

  const byItem = new Map<string, { qty: number; unit: string }>()
  for (const c of (consumption as any[]) || []) {
    const name = c.clinic_supplies?.name || 'Insumo removido'
    const prev = byItem.get(name) || { qty: 0, unit: c.clinic_supplies?.unit || 'un' }
    prev.qty += Number(c.quantity)
    byItem.set(name, prev)
  }
  const topConsumed = Array.from(byItem.entries())
    .map(([name, v]) => ({ name, value: v.qty }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return {
    summary: `${rows.length} insumos ativos no estoque, valor total ${fmtCurrency(totalValueCents)}. ${lowStock.length} com estoque baixo${lowStock.length > 0 ? ` (${lowStock.slice(0, 5).join(', ')}${lowStock.length > 5 ? '...' : ''})` : ''}. Mais consumidos no período (${label}): ${topConsumed.slice(0, 5).map(t => `${t.name} (${t.value})`).join(', ') || 'sem consumo registrado'}.`,
    view: topConsumed.length > 0
      ? { type: 'bar', data: topConsumed, color: '#f59e0b' }
      : { type: 'none' },
  }
}

