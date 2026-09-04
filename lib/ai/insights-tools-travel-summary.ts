/**
 * AI Analyst tools -- travel vertical summaries (cotações, reservas,
 * embarques, ofertas). Split out of insights-tools.ts.
 */

import type { AnalyticsContext, AnalyticsResult } from './insights-tools-definitions'
import { periodWindow, fmtCurrency } from './insights-tools-helpers'

/* ------- Travel-specific tools (cotações / reservas / embarques / ofertas) ------- */

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  rascunho: 'Rascunho',
  sent: 'Enviada',
  enviada: 'Enviada',
  approved: 'Aprovada',
  aprovada: 'Aprovada',
  rejected: 'Recusada',
  recusada: 'Recusada',
  expired: 'Expirada',
  expirada: 'Expirada',
}

export function labelStatus(map: Record<string, string>, raw: string | null): string {
  if (!raw) return 'Sem status'
  return map[raw.toLowerCase()] || raw
}

export async function queryQuotes(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('travel_proposals')
    .select('client_name, status, total_cents, created_at')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma cotação criada no período (${label}).`, view: { type: 'none' } }
  }

  const byStatus = new Map<string, number>()
  let totalCents = 0
  let approved = 0
  for (const r of rows) {
    const key = labelStatus(QUOTE_STATUS_LABEL, r.status)
    byStatus.set(key, (byStatus.get(key) || 0) + 1)
    totalCents += r.total_cents || 0
    if (['approved', 'aprovada'].includes((r.status || '').toLowerCase())) approved += 1
  }
  const approvalRate = rows.length > 0 ? (approved / rows.length) * 100 : 0

  const pieData = Array.from(byStatus.entries()).map(([name, value]) => ({ name, value }))

  // Lista de nomes vai só no texto (o view continua sendo o gráfico de
  // distribuição por status) — sem isso a IA nunca consegue responder "quem
  // pediu a cotação mais recente" ou listar clientes específicos.
  const recentList = rows.slice(0, 10).map(r => `${r.client_name || 'Sem nome'} (${labelStatus(QUOTE_STATUS_LABEL, r.status)}, ${fmtCurrency(r.total_cents || 0)}, ${new Date(r.created_at).toLocaleDateString('pt-BR')})`).join('; ')

  return {
    summary: `${rows.length} cotações no período (${label}), somando ${fmtCurrency(totalCents)}. ${approved} aprovadas (taxa de aprovação ${approvalRate.toFixed(1)}%). Distribuição por status: ${Array.from(byStatus.entries()).map(([k, v]) => `${k}: ${v}`).join(', ')}. Mais recentes: ${recentList}.`,
    view: { type: 'pie', data: pieData },
  }
}

export async function queryReservations(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('travel_sales')
    .select('contato_id, destination, status, total_cents, commission_cents, created_at')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })

  const rows = ((data as any[]) || []).filter(r => (r.status || '').toLowerCase() !== 'canceled')
  if (rows.length === 0) {
    return { summary: `Nenhuma reserva fechada no período (${label}).`, view: { type: 'none' } }
  }

  // Nome do cliente — sem isso a IA só consegue dar números agregados, nunca
  // responder "quem foi o último cliente" (motivo real de ter uma IA
  // integrada em vez de mandar o usuário olhar direto no CRM).
  const contatoIds = Array.from(new Set(rows.map(r => r.contato_id).filter(Boolean)))
  const { data: contatos } = contatoIds.length > 0
    ? await ctx.supabase.from('contatos').select('id, name').in('id', contatoIds)
    : { data: [] }
  const nameById = new Map<string, string>((contatos || []).map((c: any) => [c.id, c.name]))

  const revenue = rows.reduce((a, r) => a + (r.total_cents || 0), 0)
  const commission = rows.reduce((a, r) => a + (r.commission_cents || 0), 0)
  const ticket = rows.length > 0 ? revenue / rows.length : 0
  const mostRecent = rows[0]
  const mostRecentName = mostRecent.contato_id ? nameById.get(mostRecent.contato_id) || 'Cliente removido' : 'Sem cliente vinculado'

  const top = rows.slice(0, 30)

  return {
    summary: `${rows.length} reservas no período (${label}): faturamento ${fmtCurrency(revenue)}, comissão ${fmtCurrency(commission)}, ticket médio ${fmtCurrency(ticket)}. Reserva mais recente: ${mostRecentName}${mostRecent.destination ? ` (${mostRecent.destination})` : ''}, ${fmtCurrency(mostRecent.total_cents || 0)} em ${new Date(mostRecent.created_at).toLocaleDateString('pt-BR')}.`,
    view: {
      type: 'table',
      columns: ['Cliente', 'Destino', 'Valor', 'Comissão', 'Data'],
      rows: top.map(r => [
        r.contato_id ? (nameById.get(r.contato_id) || 'Cliente removido') : 'Sem cliente vinculado',
        r.destination || '—',
        fmtCurrency(r.total_cents || 0),
        fmtCurrency(r.commission_cents || 0),
        new Date(r.created_at).toLocaleDateString('pt-BR'),
      ]),
    },
  }
}

export async function queryDepartures(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const days = Math.min(180, Math.max(1, Number(input.dias) || 30))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const until = new Date(today)
  until.setDate(until.getDate() + days)

  const { data } = await ctx.supabase
    .from('travel_sales')
    .select('client_name, destination, departure_date, return_date, total_cents, status')
    .eq('organization_id', ctx.orgId)
    .not('departure_date', 'is', null)
    .gte('departure_date', today.toISOString().slice(0, 10))
    .lte('departure_date', until.toISOString().slice(0, 10))
    .order('departure_date', { ascending: true })
    .limit(50)

  const rows = ((data as any[]) || []).filter(r => (r.status || '').toLowerCase() !== 'canceled')
  if (rows.length === 0) {
    return { summary: `Nenhum embarque previsto nos próximos ${days} dias.`, view: { type: 'none' } }
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—'

  return {
    summary: `${rows.length} embarques previstos nos próximos ${days} dias. Próximo: ${rows[0].client_name || 'cliente'} para ${rows[0].destination || 'destino não informado'} em ${fmtDate(rows[0].departure_date)}.`,
    view: {
      type: 'table',
      columns: ['Cliente', 'Destino', 'Partida', 'Retorno', 'Valor'],
      rows: rows.map(r => [
        r.client_name || '—',
        r.destination || '—',
        fmtDate(r.departure_date),
        fmtDate(r.return_date),
        r.total_cents ? fmtCurrency(r.total_cents) : '—',
      ]),
    },
  }
}


export async function queryOffers(
  _input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { data } = await ctx.supabase
    .from('travel_showcase_packages')
    .select('category, is_published, total_cents')
    .eq('organization_id', ctx.orgId)

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhuma oferta/pacote cadastrado na vitrine.', view: { type: 'none' } }
  }

  const published = rows.filter(r => r.is_published).length
  const draft = rows.length - published
  const byCategory = new Map<string, number>()
  for (const r of rows) {
    const k = r.category || 'Sem categoria'
    byCategory.set(k, (byCategory.get(k) || 0) + 1)
  }
  const barData = Array.from(byCategory.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return {
    summary: `${rows.length} ofertas na vitrine: ${published} publicadas e ${draft} em rascunho. Categorias: ${barData.map(c => `${c.name} (${c.value})`).join(', ')}.`,
    view: { type: 'bar', data: barData, color: '#f59e0b' },
  }
}

