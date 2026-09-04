/**
 * AI Analyst tools -- cross-niche operational queries (tasks, inactive
 * customers and their last transaction, per niche). Split out of
 * insights-tools.ts.
 */

import type { AnalyticsContext, AnalyticsResult } from './insights-tools-definitions'
import { resolveOrgNicheForTools } from './insights-tools-definitions'
import { periodWindow, fmtCurrency } from './insights-tools-helpers'

type LastTransaction = { contato_id: string; amount_cents: number; date: string; extra: string | null }

export async function lastTransactionsTravel(ctx: AnalyticsContext): Promise<LastTransaction[]> {
  const { data } = await ctx.supabase
    .from('travel_sales')
    .select('contato_id, destination, total_cents, created_at, status')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'cancelado')
    .not('contato_id', 'is', null)
  const byContato = new Map<string, LastTransaction>()
  for (const r of (data as any[]) || []) {
    const prev = byContato.get(r.contato_id)
    if (!prev || r.created_at > prev.date) {
      byContato.set(r.contato_id, { contato_id: r.contato_id, amount_cents: r.total_cents || 0, date: r.created_at, extra: r.destination || null })
    }
  }
  return Array.from(byContato.values())
}

/** Nicho Clínicas: atendimentos (não é venda genérica — usa clinic_attendances). */
export async function lastTransactionsClinic(ctx: AnalyticsContext): Promise<LastTransaction[]> {
  const { data } = await ctx.supabase
    .from('clinic_attendances')
    .select('patient_contato_id, total_cents, discount_cents, attended_at, event_types(name)')
    .eq('organization_id', ctx.orgId)
    .not('patient_contato_id', 'is', null)
  const byContato = new Map<string, LastTransaction>()
  for (const r of (data as any[]) || []) {
    const prev = byContato.get(r.patient_contato_id)
    if (!prev || r.attended_at > prev.date) {
      const net = Math.max(0, (r.total_cents || 0) - (r.discount_cents || 0))
      byContato.set(r.patient_contato_id, { contato_id: r.patient_contato_id, amount_cents: net, date: r.attended_at, extra: r.event_types?.name || null })
    }
  }
  return Array.from(byContato.values())
}

/** Nicho Imobiliárias: negociações fechadas (property_deals). */
export async function lastTransactionsRealEstate(ctx: AnalyticsContext): Promise<LastTransaction[]> {
  const { data } = await ctx.supabase
    .from('property_deals')
    .select('contato_id, final_price_cents, monthly_rent_cents, closed_at, status, properties(title)')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'cancelado')
    .not('contato_id', 'is', null)
  const byContato = new Map<string, LastTransaction>()
  for (const r of (data as any[]) || []) {
    const date = r.closed_at || ''
    if (!date) continue
    const prev = byContato.get(r.contato_id)
    if (!prev || date > prev.date) {
      byContato.set(r.contato_id, { contato_id: r.contato_id, amount_cents: r.final_price_cents || r.monthly_rent_cents || 0, date, extra: r.properties?.title || null })
    }
  }
  return Array.from(byContato.values())
}

/** Demais nichos: vendas genéricas (sales). */
export async function lastTransactionsGeneric(ctx: AnalyticsContext): Promise<LastTransaction[]> {
  const { data } = await ctx.supabase
    .from('sales')
    .select('contato_id, amount_cents, sale_date, status, products(name)')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'cancelled')
    .not('contato_id', 'is', null)
  const byContato = new Map<string, LastTransaction>()
  for (const r of (data as any[]) || []) {
    const prev = byContato.get(r.contato_id)
    if (!prev || r.sale_date > prev.date) {
      byContato.set(r.contato_id, { contato_id: r.contato_id, amount_cents: r.amount_cents || 0, date: r.sale_date, extra: r.products?.name || null })
    }
  }
  return Array.from(byContato.values())
}

/**
 * Clientes sem nova venda/atendimento há N dias, com o detalhe da ÚLTIMA
 * transação — mesmo conceito de Dashboard > Clientes (RecompraTable), mas
 * generalizado pra qualquer nicho: cada um tem sua própria fonte de "venda"
 * (travel_sales, clinic_attendances, property_deals, ou o `sales` genérico),
 * já que não existe uma tabela única de vendas no CRM. Cobre o que
 * consultar_top_leads não cobre: cruzar "tempo sem comprar" com "valor da
 * última compra" — top_leads só olha contatos em geral, não transações reais.
 */
export async function queryInactiveCustomers(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const diasMin = Number(input.dias_sem_comprar) || 30
  const valorMinimoCents = input.valor_minimo_ultima_compra ? Math.round(Number(input.valor_minimo_ultima_compra) * 100) : 0

  const niche = await resolveOrgNicheForTools(ctx)
  const transactions = niche === 'travel'
    ? await lastTransactionsTravel(ctx)
    : niche === 'clinic'
      ? await lastTransactionsClinic(ctx)
      : niche === 'real_estate'
        ? await lastTransactionsRealEstate(ctx)
        : await lastTransactionsGeneric(ctx)

  if (transactions.length === 0) {
    return { summary: 'Nenhuma venda/atendimento com cliente vinculado encontrado ainda.', view: { type: 'none' } }
  }

  const { data: contatos } = await ctx.supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', ctx.orgId)
    .in('id', transactions.map(t => t.contato_id))
  const nameById = new Map<string, string>((contatos || []).map((c: any) => [c.id, c.name]))

  const now = Date.now()
  const rows = transactions
    .map(t => ({ ...t, name: nameById.get(t.contato_id) || 'Cliente removido', days: Math.floor((now - new Date(t.date).getTime()) / 86_400_000) }))
    .filter(r => r.days >= diasMin && r.amount_cents >= valorMinimoCents)
    .sort((a, b) => b.days - a.days)

  if (rows.length === 0) {
    return { summary: `Nenhum cliente encontrado com ${diasMin}+ dias sem comprar${valorMinimoCents > 0 ? ` e última compra acima de ${fmtCurrency(valorMinimoCents)}` : ''}.`, view: { type: 'none' } }
  }

  const top = rows.slice(0, 30)
  const label = niche === 'clinic' ? 'atender' : 'comprar'
  return {
    summary: `${rows.length} clientes com ${diasMin}+ dias sem ${label}${valorMinimoCents > 0 ? ` e última compra acima de ${fmtCurrency(valorMinimoCents)}` : ''}. O mais antigo: ${top[0].name}, ${top[0].days} dias, última transação de ${fmtCurrency(top[0].amount_cents)}${top[0].extra ? ` (${top[0].extra})` : ''}.`,
    view: {
      type: 'table',
      columns: ['Cliente', 'Dias sem comprar', 'Última transação', 'Detalhe', 'Data'],
      rows: top.map(r => [r.name, String(r.days), fmtCurrency(r.amount_cents), r.extra || '—', new Date(r.date).toLocaleDateString('pt-BR')]),
    },
  }
}


export async function queryTasks(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  // Tarefas criadas no período + status atual. Vencidas = due_date no passado e
  // ainda não concluídas (independente da data de criação).
  const { data } = await ctx.supabase
    .from('tasks')
    .select('status, due_date, created_at')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma tarefa criada no período (${label}).`, view: { type: 'none' } }
  }

  const now = Date.now()
  let open = 0
  let doing = 0
  let done = 0
  let overdue = 0
  for (const t of rows) {
    const status = (t.status || 'open').toLowerCase()
    if (status === 'done') done += 1
    else if (status === 'doing') doing += 1
    else open += 1
    if (status !== 'done' && t.due_date && new Date(t.due_date).getTime() < now) overdue += 1
  }

  const items = [
    { label: 'Em aberto', value: String(open) },
    { label: 'Em andamento', value: String(doing) },
    { label: 'Concluídas', value: String(done) },
    { label: 'Vencidas', value: String(overdue) },
  ]

  return {
    summary: `${rows.length} tarefas no período (${label}): ${open} em aberto, ${doing} em andamento, ${done} concluídas e ${overdue} vencidas (atrasadas).`,
    view: { type: 'kpis', items },
  }
}

