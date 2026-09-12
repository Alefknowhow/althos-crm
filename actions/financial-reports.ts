'use server'

/**
 * Financial reports: simple DRE, daily cash flow, upcoming due entries,
 * cash-flow projection. Split out of actions/financial.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireFinancialAccess, withEffectiveStatus, type FinancialEntryRow } from './financial-shared'
import { computeSimpleDRE, computeDailyCashFlow, computeCashFlowProjection, type SimpleDRE, type DailyCashFlowPoint } from '@/lib/financial/reports-calc'

export async function getSimpleDRE(orgSlug: string, range: { from: string; to: string }): Promise<SimpleDRE> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, categoria, valor_cents')
    .eq('organization_id', org.id)
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  return computeSimpleDRE(data || [])
}

export async function getDailyCashFlow(orgSlug: string, range: { from: string; to: string }): Promise<DailyCashFlowPoint[]> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents, competencia')
    .eq('organization_id', org.id)
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  return computeDailyCashFlow(data || [], range)
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

export type { CashFlowProjectionPoint, CashFlowProjection } from '@/lib/financial/reports-calc'
import type { CashFlowProjection } from '@/lib/financial/reports-calc'

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

  return computeCashFlowProjection(paid || [], (pending || []) as any, horizonDays, today)
}
