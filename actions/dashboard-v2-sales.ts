/**
 * Dashboard v2 — receita realizada (abas Visão Geral e Vendas).
 *
 * Sem 'use server': funções server-only chamadas por Server Components
 * (mesmo padrão de dashboard-core.ts). Toda query filtra por
 * `organization_id` — o `orgId` vem sempre de `getCurrentOrganization`
 * resolvido em app/app/[orgSlug]/page.tsx, nunca do client.
 *
 * Fonte de "venda": niche-aware como lib/dashboard/sales-source.ts —
 * `travel_sales` no nicho viagens (tem comissão, destino, itens inclusos),
 * `sales` + `products` nos demais.
 */

import { createClient } from '@/lib/supabase/server'
import { isOrgTravelNiche } from '@/lib/dashboard/sales-source'
import { classifySourceLabel } from '@/lib/dashboard/source-label'
import { lastNMonths, monthLabel } from '@/lib/dashboard/format'

type Supa = ReturnType<typeof createClient>

/** Status de cancelamento — o app já gravou as três grafias ao longo do tempo. */
const CANCELLED = new Set(['cancelled', 'canceled', 'cancelado'])

export type DetailedSale = {
  amount_cents: number
  commission_cents: number
  /** ISO timestamp (viagens) ou YYYY-MM-DD (genérico). */
  date: string
  seller_id: string | null
  contato_id: string | null
  /** Categoria do mix de vendas (Aéreo/Hotel/Pacote… ou categoria do produto). */
  category: string
  /** Item principal: destino (viagens) ou nome do produto. */
  item: string | null
}

/** Categoria de uma venda de viagem a partir dos itens inclusos (travel_sales.included_items)
 *  com fallback nas colunas airline/hotel_name. A venda inteira é atribuída a uma categoria —
 *  travel_sales não tem valor por item. */
function travelCategory(r: { included_items?: unknown; airline?: string | null; hotel_name?: string | null }): string {
  const items = new Set(Array.isArray(r.included_items) ? (r.included_items as string[]) : [])
  const hasAir = items.has('voos') || !!r.airline
  const hasHotel = items.has('hospedagem') || !!r.hotel_name
  if (items.has('cruzeiros')) return 'Cruzeiro'
  if (hasAir && hasHotel) return 'Pacote'
  if (hasAir) return 'Aéreo'
  if (hasHotel) return 'Hotel'
  if (items.has('seguro')) return 'Seguro'
  if (items.has('ingressos')) return 'Ingresso'
  if (items.has('transfer')) return 'Transfer'
  if (items.has('carros')) return 'Locação de carro'
  if (items.has('passeios')) return 'Passeios'
  return 'Outros'
}

export async function fetchDetailedSales(
  orgId: string,
  opts: { since?: Date; until?: Date; sellerId?: string | null } = {},
): Promise<DetailedSale[]> {
  const supabase = createClient()
  const since = opts.since ?? new Date('2015-01-01T00:00:00Z')

  if (await isOrgTravelNiche(supabase, orgId)) {
    let q = supabase
      .from('travel_sales')
      .select('total_cents, commission_cents, created_at, created_by, contato_id, status, destination, included_items, airline, hotel_name')
      .eq('organization_id', orgId)
      .gte('created_at', since.toISOString())
      .limit(20000)
    if (opts.until) q = q.lte('created_at', opts.until.toISOString())
    if (opts.sellerId) q = q.eq('created_by', opts.sellerId)
    const { data } = await q
    return ((data || []) as any[])
      .filter(r => !CANCELLED.has(String(r.status || '').toLowerCase()))
      .map(r => ({
        amount_cents: r.total_cents || 0,
        commission_cents: r.commission_cents || 0,
        date: r.created_at,
        seller_id: r.created_by ?? null,
        contato_id: r.contato_id ?? null,
        category: travelCategory(r),
        item: (r.destination || '').trim() || null,
      }))
  }

  let q = supabase
    .from('sales')
    .select('amount_cents, sale_date, seller_id, contato_id, status, products(name, type, category)')
    .eq('organization_id', orgId)
    .gte('sale_date', since.toISOString().slice(0, 10))
    .limit(20000)
  if (opts.until) q = q.lte('sale_date', opts.until.toISOString().slice(0, 10))
  if (opts.sellerId) q = q.eq('seller_id', opts.sellerId)
  const { data } = await q
  return ((data || []) as any[])
    .filter(r => !CANCELLED.has(String(r.status || '').toLowerCase()))
    .map(r => {
      const p = Array.isArray(r.products) ? r.products[0] : r.products
      return {
        amount_cents: r.amount_cents || 0,
        commission_cents: 0,
        date: r.sale_date,
        seller_id: r.seller_id ?? null,
        contato_id: r.contato_id ?? null,
        category: (p?.category || p?.type || 'Sem categoria') as string,
        item: p?.name ?? null,
      }
    })
}

export async function orgHasCommission(orgId: string): Promise<boolean> {
  return isOrgTravelNiche(createClient(), orgId)
}

/* ------------------------------------------------------------------ */

export type SalesTotals = { revenue_cents: number; sales_count: number; ticket_cents: number; commission_cents: number }

function totals(rows: DetailedSale[]): SalesTotals {
  const revenue = rows.reduce((a, r) => a + r.amount_cents, 0)
  const commission = rows.reduce((a, r) => a + r.commission_cents, 0)
  return {
    revenue_cents: revenue,
    sales_count: rows.length,
    ticket_cents: rows.length > 0 ? Math.round(revenue / rows.length) : 0,
    commission_cents: commission,
  }
}

/** Totais do período e do período anterior (para variação nos KPIs). */
export async function getSalesTotals(
  orgId: string,
  range: { start: Date; previousStart: Date; previousEnd: Date },
  sellerId?: string | null,
): Promise<{ current: SalesTotals; previous: SalesTotals | null; hasCommission: boolean }> {
  const noPrevious = range.previousStart.getTime() === range.previousEnd.getTime()
  const [cur, prev, hasCommission] = await Promise.all([
    fetchDetailedSales(orgId, { since: range.start, sellerId }),
    noPrevious ? Promise.resolve(null) : fetchDetailedSales(orgId, { since: range.previousStart, until: range.previousEnd, sellerId }),
    orgHasCommission(orgId),
  ])
  return { current: totals(cur), previous: prev ? totals(prev) : null, hasCommission }
}

/* ------------------------------------------------------------------ */

export type MonthlyRevenuePoint = {
  month: string
  label: string
  revenue_cents: number
  commission_cents: number | null
  sales_count: number
  /** Meta de receita mensal vigente (organizations.monthly_revenue_goal_cents).
   *  Não há histórico de metas no schema — o mesmo valor é aplicado a todos os meses. */
  goal_cents: number | null
  /** Comissão ÷ receita do mês, em % (null sem receita ou fora do nicho viagens). */
  commission_pct: number | null
}

export async function getOrgMonthlyGoal(orgId: string): Promise<number | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('monthly_revenue_goal_cents')
    .eq('id', orgId)
    .maybeSingle()
  return (data as { monthly_revenue_goal_cents: number | null } | null)?.monthly_revenue_goal_cents ?? null
}

/** Receita/comissão/vendas por mês nos últimos `months` meses (inclui o corrente). */
export async function getMonthlyRevenueSeries(
  orgId: string,
  opts: { months?: number; sellerId?: string | null } = {},
): Promise<{ points: MonthlyRevenuePoint[]; goalCents: number | null; hasCommission: boolean }> {
  const months = lastNMonths(opts.months ?? 12)
  const [y, m] = months[0].split('-').map(Number)
  const since = new Date(y, m - 1, 1)
  const [rows, goalCents, hasCommission] = await Promise.all([
    fetchDetailedSales(orgId, { since, sellerId: opts.sellerId }),
    getOrgMonthlyGoal(orgId),
    orgHasCommission(orgId),
  ])

  const bucket = new Map<string, { revenue: number; commission: number; count: number }>()
  for (const r of rows) {
    const k = String(r.date).slice(0, 7)
    const cur = bucket.get(k) || { revenue: 0, commission: 0, count: 0 }
    cur.revenue += r.amount_cents
    cur.commission += r.commission_cents
    cur.count += 1
    bucket.set(k, cur)
  }

  const points = months.map(month => {
    const b = bucket.get(month) || { revenue: 0, commission: 0, count: 0 }
    return {
      month,
      label: monthLabel(month),
      revenue_cents: b.revenue,
      commission_cents: hasCommission ? b.commission : null,
      sales_count: b.count,
      goal_cents: goalCents,
      commission_pct: hasCommission && b.revenue > 0 ? (b.commission / b.revenue) * 100 : null,
    }
  })
  return { points, goalCents, hasCommission }
}

/* ------------------------------------------------------------------ */

export type MonthGoalProgress = { goalCents: number | null; realizedCents: number; salesCount: number }

/** Meta consolidada do mês calendário corrente x receita realizada (mesma fonte de venda
 *  do resto da aba — `sales`/`travel_sales`). Sempre org inteira. */
export async function getMonthGoalProgress(orgId: string): Promise<MonthGoalProgress> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [rows, goalCents] = await Promise.all([
    fetchDetailedSales(orgId, { since: monthStart }),
    getOrgMonthlyGoal(orgId),
  ])
  return { goalCents, realizedCents: rows.reduce((a, r) => a + r.amount_cents, 0), salesCount: rows.length }
}

/* ------------------------------------------------------------------ */

export type RevenueBySourceRow = { source: string; revenue_cents: number; sales_count: number }

async function sourcesForContatos(supabase: Supa, orgId: string, ids: string[]) {
  const out = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300)
    const { data } = await supabase
      .from('contatos')
      .select('id, source, referred_by_contato_id, referred_by_name')
      .eq('organization_id', orgId)
      .in('id', chunk)
    for (const c of (data || []) as any[]) {
      out.set(c.id, classifySourceLabel(c.source, !!(c.referred_by_contato_id || c.referred_by_name)))
    }
  }
  return out
}

/** Receita realizada agrupada pela origem do contato que comprou (venda → contato → source). */
export async function getRevenueBySource(
  orgId: string,
  since: Date,
  sellerId?: string | null,
): Promise<RevenueBySourceRow[]> {
  const supabase = createClient()
  const rows = await fetchDetailedSales(orgId, { since, sellerId })
  const ids = Array.from(new Set(rows.map(r => r.contato_id).filter(Boolean))) as string[]
  const sourceById = await sourcesForContatos(supabase, orgId, ids)

  const by = new Map<string, RevenueBySourceRow>()
  for (const r of rows) {
    const label = r.contato_id ? sourceById.get(r.contato_id) || 'Manual' : 'Sem contato'
    const cur = by.get(label) || { source: label, revenue_cents: 0, sales_count: 0 }
    cur.revenue_cents += r.amount_cents
    cur.sales_count += 1
    by.set(label, cur)
  }
  return Array.from(by.values()).sort((a, b) => b.revenue_cents - a.revenue_cents)
}

/* ------------------------------------------------------------------ */

export type TopItemRow = { item: string; sales_count: number; revenue_cents: number; ticket_cents: number }

/** Top destinos (viagens) ou top produtos (demais nichos), por receita. */
export async function getTopItems(
  orgId: string,
  since: Date,
  opts: { sellerId?: string | null; limit?: number } = {},
): Promise<{ rows: TopItemRow[]; isTravel: boolean }> {
  const [rows, isTravel] = await Promise.all([
    fetchDetailedSales(orgId, { since, sellerId: opts.sellerId }),
    orgHasCommission(orgId),
  ])
  const by = new Map<string, { label: string; count: number; revenue: number }>()
  for (const r of rows) {
    if (!r.item) continue
    const key = r.item.toLowerCase()
    const cur = by.get(key) || { label: r.item, count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += r.amount_cents
    by.set(key, cur)
  }
  return {
    isTravel,
    rows: Array.from(by.values())
      .map(v => ({ item: v.label, sales_count: v.count, revenue_cents: v.revenue, ticket_cents: v.count > 0 ? Math.round(v.revenue / v.count) : 0 }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents)
      .slice(0, opts.limit ?? 8),
  }
}

/* ------------------------------------------------------------------ */

export type SalesMixRow = { category: string; revenue_cents: number; sales_count: number; pct: number }

/** Participação de cada categoria na receita do período (para a barra empilhada 100%). */
export async function getSalesMix(orgId: string, since: Date, sellerId?: string | null): Promise<SalesMixRow[]> {
  const rows = await fetchDetailedSales(orgId, { since, sellerId })
  const total = rows.reduce((a, r) => a + r.amount_cents, 0)
  const by = new Map<string, { revenue: number; count: number }>()
  for (const r of rows) {
    const cur = by.get(r.category) || { revenue: 0, count: 0 }
    cur.revenue += r.amount_cents
    cur.count += 1
    by.set(r.category, cur)
  }
  return Array.from(by.entries())
    .map(([category, v]) => ({ category, revenue_cents: v.revenue, sales_count: v.count, pct: total > 0 ? (v.revenue / total) * 100 : 0 }))
    .sort((a, b) => b.revenue_cents - a.revenue_cents)
}
