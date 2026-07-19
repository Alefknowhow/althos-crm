'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchNormalizedSales, isOrgTravelNiche } from '@/lib/dashboard/sales-source'

/* -------- Ticket médio (receita ÷ nº de vendas concluídas) -------- */

export type TicketMedio = {
  avg_cents: number
  sales_count: number
  revenue_cents: number
}

export async function getTicketMedio(orgId: string, since: Date): Promise<TicketMedio> {
  const supabase = createClient()
  const rows = await fetchNormalizedSales(supabase, orgId, { since, onlyCompleted: true })
  const revenue = rows.reduce((a, r) => a + (r.amount_cents || 0), 0)
  return {
    avg_cents: rows.length > 0 ? Math.round(revenue / rows.length) : 0,
    sales_count: rows.length,
    revenue_cents: revenue,
  }
}

/* -------- Mais vendidos (agregação sales × products) -------- */

export type TopProductRow = {
  product_id: string
  name: string
  type: string | null
  quantity: number
  total_cents: number
}

/**
 * Ranks products by units sold in the window. Only meaningful for orgs on the
 * generic `sales`/`products` schema — travel-niche orgs record deals in
 * `travel_sales` (no product catalog), so they get an empty list here.
 */
export async function getTopProducts(orgId: string, since: Date, limit = 6): Promise<TopProductRow[]> {
  const supabase = createClient()
  if (await isOrgTravelNiche(supabase, orgId)) return []

  const { data } = await supabase
    .from('sales')
    .select('product_id, quantity, amount_cents, products(id, name, type)')
    .eq('organization_id', orgId)
    .neq('status', 'cancelled')
    .gte('sale_date', since.toISOString().slice(0, 10))
    .not('product_id', 'is', null)

  const byProduct = new Map<string, TopProductRow>()
  for (const r of (data || []) as any[]) {
    const product = r.products
    if (!product) continue
    const cur = byProduct.get(product.id) || {
      product_id: product.id,
      name: product.name,
      type: product.type ?? null,
      quantity: 0,
      total_cents: 0,
    }
    cur.quantity += r.quantity || 1
    cur.total_cents += r.amount_cents || 0
    byProduct.set(product.id, cur)
  }

  return Array.from(byProduct.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit)
}
