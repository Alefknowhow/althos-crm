'use server'

/**
 * Financial dashboard aggregations: summary, KPIs, cash-flow series,
 * expense/revenue breakdown. Split out of actions/financial.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { previousRange } from '@/lib/utils/period-range'
import { requireFinancialAccess } from './financial-shared'
import { buildKpi, computeCashFlowSeries, groupSum, computeRevenueBreakdown, computeExpenseBreakdown, type KpiValue, type RevenueBreakdown, type ExpenseBreakdown } from '@/lib/financial/reports-calc'

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

export type { KpiValue }

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

  const kpi = buildKpi

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

  return computeCashFlowSeries(data || [], months, now)
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

  return groupSum((data || []).map(r => ({ label: r.categoria, valor_cents: r.valor_cents })))
    .map(({ label, valor_cents }) => ({ categoria: label, valor_cents }))
}

export type { RevenueBreakdown }

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

  return computeRevenueBreakdown(rows, contatoNames)
}

export type { ExpenseBreakdown }

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

  return computeExpenseBreakdown(data || [])
}
