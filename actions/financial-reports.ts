'use server'

/**
 * Financial reports: simple DRE, daily cash flow, upcoming due entries,
 * cash-flow projection. Split out of actions/financial.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireFinancialAccess, withEffectiveStatus, type FinancialEntryRow } from './financial-shared'

export async function getSimpleDRE(
  orgSlug: string,
  range: { from: string; to: string },
): Promise<{ receita_total_cents: number; despesas_por_categoria: { categoria: string; valor_cents: number }[]; resultado_cents: number }> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, categoria, valor_cents')
    .eq('organization_id', org.id)
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  let receita_total_cents = 0
  const despesasMap = new Map<string, number>()
  for (const row of data || []) {
    if (row.tipo === 'receita') {
      receita_total_cents += row.valor_cents
    } else {
      despesasMap.set(row.categoria, (despesasMap.get(row.categoria) || 0) + row.valor_cents)
    }
  }
  const despesas_por_categoria = Array.from(despesasMap.entries())
    .map(([categoria, valor_cents]) => ({ categoria, valor_cents }))
    .sort((a, b) => b.valor_cents - a.valor_cents)
  const despesas_total_cents = despesas_por_categoria.reduce((a, d) => a + d.valor_cents, 0)

  return { receita_total_cents, despesas_por_categoria, resultado_cents: receita_total_cents - despesas_total_cents }
}

export async function getDailyCashFlow(
  orgSlug: string,
  range: { from: string; to: string },
): Promise<{ day: string; receitas_cents: number; despesas_cents: number; saldo_cents: number }[]> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents, competencia')
    .eq('organization_id', org.id)
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  const buckets = new Map<string, { receitas_cents: number; despesas_cents: number }>()
  const start = new Date(range.from + 'T12:00:00')
  const end = new Date(range.to + 'T12:00:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    buckets.set(d.toISOString().slice(0, 10), { receitas_cents: 0, despesas_cents: 0 })
  }

  for (const row of data || []) {
    const bucket = buckets.get(row.competencia)
    if (!bucket) continue
    if (row.tipo === 'receita') bucket.receitas_cents += row.valor_cents
    else bucket.despesas_cents += row.valor_cents
  }

  let running = 0
  return Array.from(buckets.entries()).map(([day, v]) => {
    running += v.receitas_cents - v.despesas_cents
    return { day, ...v, saldo_cents: running }
  })
}

export type UpcomingDueEntry = {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  valor_cents: number
  vencimento: string
  status: FinancialEntryRow['status']
}

export async function getUpcomingDueEntries(orgSlug: string, days = 30): Promise<UpcomingDueEntry[]> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()

  const today = new Date()
  const limit = new Date(today)
  limit.setDate(limit.getDate() + days)

  const { data } = await supabase
    .from('financial_entries')
    .select('id, tipo, categoria, valor_cents, vencimento, status')
    .eq('organization_id', org.id)
    .in('status', ['pendente', 'vencido'])
    .not('vencimento', 'is', null)
    .lte('vencimento', limit.toISOString().slice(0, 10))
    .order('vencimento', { ascending: true })
    .limit(50)

  return ((data as UpcomingDueEntry[]) ?? []).map(e => withEffectiveStatus(e as any)) as UpcomingDueEntry[]
}

export type CashFlowProjectionPoint = { day: string; saldo_previsto_cents: number }
export type CashFlowProjection = {
  startingBalance_cents: number
  series: CashFlowProjectionPoint[]
  checkpoints: { d30: number; d60: number; d90: number }
}

/**
 * Projeção de caixa pros próximos 90 dias: parte do saldo em caixa atual (só
 * pago) e soma dia a dia os lançamentos pendentes/vencidos por vencimento —
 * "se nada mais entrar além do que já está lançado, como fica o caixa".
 */
export async function getCashFlowProjection(orgSlug: string, horizonDays = 90): Promise<CashFlowProjection> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()

  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const limit = new Date(today)
  limit.setDate(limit.getDate() + horizonDays)

  const [{ data: paid }, { data: pending }] = await Promise.all([
    supabase
      .from('financial_entries')
      .select('tipo, valor_cents')
      .eq('organization_id', org.id)
      .eq('status', 'pago')
      .lte('data_pagamento', todayIso),
    supabase
      .from('financial_entries')
      .select('tipo, valor_cents, vencimento')
      .eq('organization_id', org.id)
      .in('status', ['pendente', 'vencido'])
      .not('vencimento', 'is', null)
      .lte('vencimento', limit.toISOString().slice(0, 10)),
  ])

  const startingBalance = (paid || []).reduce((a, r) => a + (r.tipo === 'receita' ? r.valor_cents : -r.valor_cents), 0)

  const byDay = new Map<string, number>()
  for (const row of pending || []) {
    const v = row.tipo === 'receita' ? row.valor_cents : -row.valor_cents
    byDay.set(row.vencimento!, (byDay.get(row.vencimento!) || 0) + v)
  }

  const series: CashFlowProjectionPoint[] = []
  let running = startingBalance
  const checkpoints = { d30: startingBalance, d60: startingBalance, d90: startingBalance }
  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    running += byDay.get(key) || 0
    series.push({ day: key, saldo_previsto_cents: running })
    if (i === 30) checkpoints.d30 = running
    if (i === 60) checkpoints.d60 = running
    if (i === 90) checkpoints.d90 = running
  }

  return { startingBalance_cents: startingBalance, series, checkpoints }
}
