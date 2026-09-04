'use server'

/**
 * Equipe: conversão por vendedor, negociações abertas, score,
 * vendas mensais, comparação entre vendedores.
 * Split out of actions/dashboard-tabs.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { isOrgTravelNiche } from '@/lib/dashboard/sales-source'
import { getSellersRanking } from '@/actions/dashboard'

/* -------- Equipe: conversão por vendedor, negociações abertas, score -------- */

export type SellerConversionRow = { seller_id: string; leads: number; won: number; conversion_pct: number }

/** Conversão por vendedor = leads atribuídos (assigned_to) no período vs. quantos chegaram a "ganho" (deal_status). */
export async function getSellerConversionRates(orgId: string, windowDays = 30): Promise<SellerConversionRow[]> {
  const supabase = createClient()
  const since = new Date()
  since.setDate(since.getDate() - windowDays)

  const { data } = await supabase
    .from('contatos')
    .select('assigned_to, deal_status')
    .eq('organization_id', orgId)
    .not('assigned_to', 'is', null)
    .gte('created_at', since.toISOString())

  const bySeller = new Map<string, { leads: number; won: number }>()
  for (const r of data || []) {
    const cur = bySeller.get(r.assigned_to as string) || { leads: 0, won: 0 }
    cur.leads += 1
    if (r.deal_status === 'ganho') cur.won += 1
    bySeller.set(r.assigned_to as string, cur)
  }

  return Array.from(bySeller.entries())
    .map(([seller_id, v]) => ({ seller_id, leads: v.leads, won: v.won, conversion_pct: v.leads > 0 ? (v.won / v.leads) * 100 : 0 }))
    .sort((a, b) => b.conversion_pct - a.conversion_pct)
}

export type SellerOpenDealsRow = { seller_id: string; open_deals: number }

/** Negociações abertas por vendedor — contatos com deal_status='aberto' atribuídos a cada um. */
export async function getSellerOpenDeals(orgId: string): Promise<SellerOpenDealsRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('assigned_to')
    .eq('organization_id', orgId)
    .eq('deal_status', 'aberto')
    .not('assigned_to', 'is', null)

  const bySeller = new Map<string, number>()
  for (const r of data || []) {
    const k = r.assigned_to as string
    bySeller.set(k, (bySeller.get(k) || 0) + 1)
  }
  return Array.from(bySeller.entries())
    .map(([seller_id, open_deals]) => ({ seller_id, open_deals }))
    .sort((a, b) => b.open_deals - a.open_deals)
}

export type SellerScoreRow = { seller_id: string; score: number }

/**
 * Score de performance (0-100) = média entre a posição relativa em valor
 * vendido e a posição relativa em taxa de conversão, ambas normalizadas
 * pelo melhor vendedor do período — sem pesos "mágicos" arbitrários, é
 * simplesmente "o quão perto você está do topo em cada critério".
 */
export async function getSellerPerformanceScore(orgId: string, windowDays = 30): Promise<SellerScoreRow[]> {
  const [ranking, conversion] = await Promise.all([
    getSellersRanking(orgId, { windowDays }),
    getSellerConversionRates(orgId, windowDays),
  ])
  const maxValue = Math.max(1, ...ranking.map(r => r.total_value_cents))
  const maxConversion = Math.max(1, ...conversion.map(c => c.conversion_pct))
  const conversionBySeller = new Map(conversion.map(c => [c.seller_id, c.conversion_pct]))

  const sellerIds = new Set([...ranking.map(r => r.seller_id), ...conversion.map(c => c.seller_id)])
  const valueBySeller = new Map(ranking.map(r => [r.seller_id, r.total_value_cents]))

  return Array.from(sellerIds)
    .map(seller_id => {
      const valueScore = ((valueBySeller.get(seller_id) || 0) / maxValue) * 100
      const conversionScore = ((conversionBySeller.get(seller_id) || 0) / maxConversion) * 100
      return { seller_id, score: Math.round((valueScore + conversionScore) / 2) }
    })
    .sort((a, b) => b.score - a.score)
}

/* -------- Redesign da aba Equipe: faturamento/comissão mensal, comparativo, destinos -------- */

export type MonthlySalesRow = {
  seller_id: string | null
  month: string // YYYY-MM
  revenue_cents: number
  commission_cents: number | null
  sales_count: number
}

/**
 * Vendas por vendedor, agregadas por mês, nos últimos `monthsBack` meses.
 * Niche-aware como fetchNormalizedSales, mas inclui commission_cents (só
 * existe em travel_sales — a tabela genérica `sales` não tem conceito de
 * comissão, por isso não é o caso de estender fetchNormalizedSales, que é
 * usado por vários outros consumidores). Granularidade por vendedor+mês
 * permite ao client agregar por mês (somando todos) ou por vendedor
 * selecionado, sem nova ida ao servidor.
 */
export async function getMonthlySalesBySeller(orgId: string, monthsBack = 6): Promise<MonthlySalesRow[]> {
  const supabase = createClient()
  const since = new Date()
  since.setMonth(since.getMonth() - (monthsBack - 1), 1)
  since.setHours(0, 0, 0, 0)

  const hasCommission = await isOrgTravelNiche(supabase, orgId)
  const bucket = new Map<string, { revenue: number; commission: number; count: number }>()

  if (hasCommission) {
    const { data } = await supabase
      .from('travel_sales')
      .select('total_cents, commission_cents, created_at, created_by, status')
      .eq('organization_id', orgId)
      .gte('created_at', since.toISOString())
    for (const r of (data || []) as any[]) {
      if (r.status === 'canceled') continue
      const month = String(r.created_at).slice(0, 7)
      const key = `${r.created_by || '__none__'}|${month}`
      const cur = bucket.get(key) || { revenue: 0, commission: 0, count: 0 }
      cur.revenue += r.total_cents || 0
      cur.commission += r.commission_cents || 0
      cur.count += 1
      bucket.set(key, cur)
    }
  } else {
    const { data } = await supabase
      .from('sales')
      .select('amount_cents, sale_date, seller_id, status')
      .eq('organization_id', orgId)
      .gte('sale_date', since.toISOString().slice(0, 10))
      .neq('status', 'cancelled')
    for (const r of (data || []) as any[]) {
      const month = String(r.sale_date).slice(0, 7)
      const key = `${r.seller_id || '__none__'}|${month}`
      const cur = bucket.get(key) || { revenue: 0, commission: 0, count: 0 }
      cur.revenue += r.amount_cents || 0
      cur.count += 1
      bucket.set(key, cur)
    }
  }

  return Array.from(bucket.entries()).map(([key, v]) => {
    const [sellerId, month] = key.split('|')
    return {
      seller_id: sellerId === '__none__' ? null : sellerId,
      month,
      revenue_cents: v.revenue,
      commission_cents: hasCommission ? v.commission : null,
      sales_count: v.count,
    }
  })
}

export type SellerComparisonRow = {
  seller_id: string | null
  sales_count: number
  revenue_cents: number
  commission_cents: number | null
  avg_ticket_cents: number
}

/**
 * Comparativo de vendedores no período — espelha a agregação do relatório
 * de Comissões (actions/reports.ts, linhas 267-313), sem CSV/impressão,
 * pra alimentar o card de comparação da aba Equipe.
 */
export async function getSellerComparison(orgId: string, since: Date): Promise<SellerComparisonRow[]> {
  const supabase = createClient()
  const hasCommission = await isOrgTravelNiche(supabase, orgId)
  const bucket = new Map<string, { revenue: number; commission: number; count: number }>()

  if (hasCommission) {
    const { data } = await supabase
      .from('travel_sales')
      .select('total_cents, commission_cents, created_at, created_by, status')
      .eq('organization_id', orgId)
      .gte('created_at', since.toISOString())
    for (const r of (data || []) as any[]) {
      if (r.status === 'canceled') continue
      const key = r.created_by || '__none__'
      const cur = bucket.get(key) || { revenue: 0, commission: 0, count: 0 }
      cur.revenue += r.total_cents || 0
      cur.commission += r.commission_cents || 0
      cur.count += 1
      bucket.set(key, cur)
    }
  } else {
    const { data } = await supabase
      .from('sales')
      .select('amount_cents, sale_date, seller_id, status')
      .eq('organization_id', orgId)
      .gte('sale_date', since.toISOString().slice(0, 10))
      .neq('status', 'cancelled')
    for (const r of (data || []) as any[]) {
      const key = r.seller_id || '__none__'
      const cur = bucket.get(key) || { revenue: 0, commission: 0, count: 0 }
      cur.revenue += r.amount_cents || 0
      cur.count += 1
      bucket.set(key, cur)
    }
  }

  return Array.from(bucket.entries())
    .map(([key, v]) => ({
      seller_id: key === '__none__' ? null : key,
      sales_count: v.count,
      revenue_cents: v.revenue,
      commission_cents: hasCommission ? v.commission : null,
      avg_ticket_cents: v.count > 0 ? Math.round(v.revenue / v.count) : 0,
    }))
    .sort((a, b) => b.revenue_cents - a.revenue_cents)
}
