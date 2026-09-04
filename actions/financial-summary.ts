'use server'

/**
 * Financial dashboard aggregations: summary, KPIs, cash-flow series,
 * expense/revenue breakdown. Split out of actions/financial.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { previousRange } from '@/lib/utils/period-range'
import { requireFinancialAccess } from './financial-shared'

// ── Agregações do dashboard ──────────────────────────────────────────────────

export async function getFinancialSummary(
  orgSlug: string,
  range: { from: string; to: string },
): Promise<{ receitas_cents: number; despesas_cents: number; saldo_cents: number }> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents')
    .eq('organization_id', org.id)
    .gte('competencia', range.from)
    .lte('competencia', range.to)
    .neq('status', 'cancelado')

  let receitas_cents = 0
  let despesas_cents = 0
  for (const row of data || []) {
    if (row.tipo === 'receita') receitas_cents += row.valor_cents
    else despesas_cents += row.valor_cents
  }
  return { receitas_cents, despesas_cents, saldo_cents: receitas_cents - despesas_cents }
}

export type KpiValue = { value_cents: number; delta_pct: number | null; trend: 'up' | 'down' | 'neutral' }

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : null // sem base de comparação — não inventa %
  return ((current - previous) / Math.abs(previous)) * 100
}

function trendOf(delta: number | null, higherIsBetter: boolean): 'up' | 'down' | 'neutral' {
  if (delta === null || Math.abs(delta) < 0.5) return 'neutral'
  const up = delta > 0
  return (higherIsBetter ? up : !up) ? 'up' : 'down'
}

/**
 * Os 8 indicadores do "Resumo Financeiro" (topo da dashboard), cada um com
 * comparação real vs. o período imediatamente anterior de mesma duração
 * (lib/utils/period-range.ts::previousRange) — não é só sinal de saldo, é
 * delta percentual de verdade calculado a partir dos mesmos lançamentos.
 */
export type FinancialKpis = Awaited<ReturnType<typeof getFinancialKpis>>

export async function getFinancialKpis(orgSlug: string, range: { from: string; to: string }) {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()
  const prev = previousRange(range)

  const [curr, prevData, openReceivables, openPayables] = await Promise.all([
    getFinancialSummary(orgSlug, range),
    getFinancialSummary(orgSlug, prev),
    // Contas a receber/pagar em aberto — posição atual, não limitada ao período
    // selecionado (é "quanto tenho pra receber/pagar agora", não "no período").
    supabase
      .from('financial_entries')
      .select('tipo, valor_cents, status')
      .eq('organization_id', org.id)
      .eq('tipo', 'receita')
      .in('status', ['pendente', 'vencido']),
    supabase
      .from('financial_entries')
      .select('tipo, valor_cents, status')
      .eq('organization_id', org.id)
      .eq('tipo', 'despesa')
      .in('status', ['pendente', 'vencido']),
  ])

  // Saldo em caixa = posição acumulada desde sempre até o fim do período (só
  // lançamentos efetivamente pagos — é caixa de verdade, não competência).
  const { data: paidToDate } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents')
    .eq('organization_id', org.id)
    .eq('status', 'pago')
    .lte('data_pagamento', range.to)
  const { data: paidToDatePrev } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents')
    .eq('organization_id', org.id)
    .eq('status', 'pago')
    .lte('data_pagamento', prev.to)

  const sumCaixa = (rows: { tipo: string; valor_cents: number }[] | null) =>
    (rows || []).reduce((a, r) => a + (r.tipo === 'receita' ? r.valor_cents : -r.valor_cents), 0)
  const saldoCaixa = sumCaixa(paidToDate)
  const saldoCaixaPrev = sumCaixa(paidToDatePrev)

  const contasReceberCents = (openReceivables.data || []).reduce((a, r) => a + r.valor_cents, 0)
  const contasPagarCents = (openPayables.data || []).reduce((a, r) => a + r.valor_cents, 0)

  const lucroLiquido = curr.saldo_cents
  const lucroLiquidoPrev = prevData.saldo_cents
  const margem = curr.receitas_cents > 0 ? (lucroLiquido / curr.receitas_cents) * 100 : null
  const margemPrev = prevData.receitas_cents > 0 ? (lucroLiquidoPrev / prevData.receitas_cents) * 100 : null

  // Fluxo de caixa previsto = receitas pendentes - despesas pendentes que
  // vencem dentro do próprio período selecionado (o que ainda deve entrar/
  // sair de caixa até o fim do período, distinto do que já foi pago).
  const { data: pendingInRange } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents')
    .eq('organization_id', org.id)
    .in('status', ['pendente', 'vencido'])
    .gte('vencimento', range.from)
    .lte('vencimento', range.to)
  const fluxoPrevisto = (pendingInRange || []).reduce((a, r) => a + (r.tipo === 'receita' ? r.valor_cents : -r.valor_cents), 0)

  function kpi(current: number, previous: number, higherIsBetter = true): KpiValue {
    const delta = pctDelta(current, previous)
    return { value_cents: current, delta_pct: delta, trend: trendOf(delta, higherIsBetter) }
  }

  return {
    saldoEmCaixa: kpi(saldoCaixa, saldoCaixaPrev),
    receitaDoMes: kpi(curr.receitas_cents, prevData.receitas_cents),
    despesaDoMes: kpi(curr.despesas_cents, prevData.despesas_cents, false),
    lucroLiquido: kpi(lucroLiquido, lucroLiquidoPrev),
    margemLucroPct: margem,
    margemLucroPctPrev: margemPrev,
    fluxoCaixaPrevistoCents: fluxoPrevisto,
    contasAReceberCents: contasReceberCents,
    contasAPagarCents: contasPagarCents,
  }
}

export async function getCashFlowSeries(
  orgSlug: string,
  months = 6,
): Promise<{ month: string; receitas_cents: number; despesas_cents: number; saldo_cents: number }[]> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const fromStr = from.toISOString().slice(0, 10)

  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents, competencia')
    .eq('organization_id', org.id)
    .gte('competencia', fromStr)
    .neq('status', 'cancelado')

  const buckets = new Map<string, { receitas_cents: number; despesas_cents: number }>()
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, { receitas_cents: 0, despesas_cents: 0 })
  }

  for (const row of data || []) {
    const key = row.competencia.slice(0, 7)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (row.tipo === 'receita') bucket.receitas_cents += row.valor_cents
    else bucket.despesas_cents += row.valor_cents
  }

  // Saldo acumulado mês a mês (receita - despesa, corrido dentro da janela
  // exibida) — mesma lógica de linha corrida usada no fluxo de caixa diário.
  let running = 0
  return Array.from(buckets.entries()).map(([month, v]) => {
    running += v.receitas_cents - v.despesas_cents
    return { month, ...v, saldo_cents: running }
  })
}

export async function getExpensesByCategory(
  orgSlug: string,
  range: { from: string; to: string },
): Promise<{ categoria: string; valor_cents: number }[]> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('categoria, valor_cents')
    .eq('organization_id', org.id)
    .eq('tipo', 'despesa')
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  const byCategory = new Map<string, number>()
  for (const row of data || []) {
    byCategory.set(row.categoria, (byCategory.get(row.categoria) || 0) + row.valor_cents)
  }
  return Array.from(byCategory.entries())
    .map(([categoria, valor_cents]) => ({ categoria, valor_cents }))
    .sort((a, b) => b.valor_cents - a.valor_cents)
}

export type RevenueBreakdown = {
  porCategoria: { label: string; valor_cents: number }[]
  porFormaPagamento: { label: string; valor_cents: number }[]
  porOperadora: { label: string; valor_cents: number }[]
  porCliente: { label: string; valor_cents: number }[]
  ticketMedioCents: number
  receitaRecorrenteCents: number
  receitaTotalCents: number
}

function groupSum(rows: { label: string | null; valor_cents: number }[]): { label: string; valor_cents: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const key = r.label || 'Não informado'
    map.set(key, (map.get(key) || 0) + r.valor_cents)
  }
  return Array.from(map.entries()).map(([label, valor_cents]) => ({ label, valor_cents })).sort((a, b) => b.valor_cents - a.valor_cents)
}

/**
 * Receita segmentada por produto/categoria, forma de pagamento, operadora
 * (proxy de "origem" — de onde vem a receita) e cliente, além de ticket
 * médio e receita recorrente (lançamentos com is_recurring) — tudo a partir
 * dos campos já existentes em financial_entries, sem precisar de novas
 * colunas nem joins pesados com travel_sales.
 */
export async function getRevenueBreakdown(orgSlug: string, range: { from: string; to: string }): Promise<RevenueBreakdown> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('categoria, forma_pagamento, operadora, contato_id, valor_cents, is_recurring')
    .eq('organization_id', org.id)
    .eq('tipo', 'receita')
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  const rows = data || []
  const contatoIds = Array.from(new Set(rows.map(r => r.contato_id).filter(Boolean))) as string[]
  const contatoNames = new Map<string, string>()
  if (contatoIds.length > 0) {
    const { data: contatos } = await supabase.from('contatos').select('id, name').in('id', contatoIds)
    for (const c of contatos || []) contatoNames.set(c.id, c.name)
  }

  const receitaTotalCents = rows.reduce((a, r) => a + r.valor_cents, 0)
  const receitaRecorrenteCents = rows.filter(r => r.is_recurring).reduce((a, r) => a + r.valor_cents, 0)
  const ticketMedioCents = rows.length > 0 ? Math.round(receitaTotalCents / rows.length) : 0

  return {
    porCategoria: groupSum(rows.map(r => ({ label: r.categoria, valor_cents: r.valor_cents }))),
    porFormaPagamento: groupSum(rows.map(r => ({ label: r.forma_pagamento, valor_cents: r.valor_cents }))),
    porOperadora: groupSum(rows.map(r => ({ label: r.operadora, valor_cents: r.valor_cents }))),
    porCliente: groupSum(rows.map(r => ({ label: r.contato_id ? contatoNames.get(r.contato_id) || 'Cliente removido' : null, valor_cents: r.valor_cents }))),
    ticketMedioCents,
    receitaRecorrenteCents,
    receitaTotalCents,
  }
}

export type ExpenseBreakdown = {
  porSubcategoria: { label: string; valor_cents: number }[]
  porCentroCusto: { label: string; valor_cents: number }[]
  fixasCents: number
  variaveisCents: number
  despesaTotalCents: number
}

/**
 * Despesas por subcategoria e centro de custo, e separação fixas
 * (is_recurring — lançamentos recorrentes materializados) vs. variáveis.
 */
export async function getExpenseBreakdown(orgSlug: string, range: { from: string; to: string }): Promise<ExpenseBreakdown> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('subcategoria, centro_custo, valor_cents, is_recurring')
    .eq('organization_id', org.id)
    .eq('tipo', 'despesa')
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  const rows = data || []
  const despesaTotalCents = rows.reduce((a, r) => a + r.valor_cents, 0)
  const fixasCents = rows.filter(r => r.is_recurring).reduce((a, r) => a + r.valor_cents, 0)

  return {
    porSubcategoria: groupSum(rows.map(r => ({ label: r.subcategoria, valor_cents: r.valor_cents }))),
    porCentroCusto: groupSum(rows.map(r => ({ label: r.centro_custo, valor_cents: r.valor_cents }))),
    fixasCents,
    variaveisCents: despesaTotalCents - fixasCents,
    despesaTotalCents,
  }
}
