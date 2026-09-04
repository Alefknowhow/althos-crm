'use server'

/**
 * Ticket médio, top products, and lead source returns.
 * Split out of actions/dashboard-tabs.ts.
 */

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
  /** Só > 0 no nicho viagens (travel_sales.commission_cents) — genérico não
   *  tem conceito de comissão por venda. */
  commission_cents: number
}

/**
 * Agências de viagem não vendem "produtos" no sentido genérico — o que
 * importa ranquear é o destino mais vendido, não hotel/aéreo/serviço
 * avulso (que já é um detalhe da venda, não o produto em si).
 */
async function getTopProductsTravel(supabase: ReturnType<typeof createClient>, orgId: string, since: Date, limit: number): Promise<TopProductRow[]> {
  const { data } = await supabase
    .from('travel_sales')
    .select('destination, total_cents, commission_cents')
    .eq('organization_id', orgId)
    .neq('status', 'cancelado')
    .gte('created_at', since.toISOString())

  const byDestination = new Map<string, TopProductRow>()
  for (const r of (data || []) as any[]) {
    const destination = (r.destination || '').trim()
    if (!destination) continue
    const key = destination.toLowerCase()
    const cur = byDestination.get(key) || { product_id: key, name: destination, type: 'Destino', quantity: 0, total_cents: 0, commission_cents: 0 }
    cur.quantity += 1
    cur.total_cents += r.total_cents || 0
    cur.commission_cents += r.commission_cents || 0
    byDestination.set(key, cur)
  }

  return Array.from(byDestination.values())
    .sort((a, b) => b.commission_cents - a.commission_cents)
    .slice(0, limit)
}

/**
 * Ranks products by units sold in the window. Travel-niche orgs record deals
 * in `travel_sales` (no product catalog) — reads the same info from the
 * reservation's fields (hotel/aéreo/serviços) instead.
 */
export async function getTopProducts(orgId: string, since: Date, limit = 6): Promise<TopProductRow[]> {
  const supabase = createClient()
  if (await isOrgTravelNiche(supabase, orgId)) return getTopProductsTravel(supabase, orgId, since, limit)

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
      commission_cents: 0,
    }
    cur.quantity += r.quantity || 1
    cur.total_cents += r.amount_cents || 0
    byProduct.set(product.id, cur)
  }

  // Nicho genérico não tem comissão por venda — ranqueia por receita total.
  return Array.from(byProduct.values())
    .sort((a, b) => b.total_cents - a.total_cents)
    .slice(0, limit)
}

/* -------- Retorno por origem do lead (nicho viagens) -------- */

/**
 * Agrupa o `contatos.source` (texto livre, gravado pelos vários fluxos de
 * entrada — webhook do WhatsApp, formulário público, DM do Instagram,
 * criação manual, importação) num pequeno conjunto de rótulos legíveis.
 * Prefixos conhecidos viram um rótulo fixo; qualquer coisa fora desses
 * prefixos aparece com o próprio texto capitalizado, em vez de cair tudo
 * genericamente em "Outro" — assim uma origem nova (ex.: um webhook futuro)
 * já aparece com nome legível sem precisar editar este mapa.
 */
function classifyLeadSource(raw: string | null): string {
  const s = (raw || '').trim().toLowerCase()
  if (!s) return 'Manual'
  if (s.startsWith('whatsapp')) return 'WhatsApp'
  if (s.startsWith('instagram')) return 'Instagram'
  if (s.startsWith('form')) return 'Formulário'
  if (s.startsWith('manual')) return 'Manual'
  if (s.startsWith('api') || s.startsWith('csv')) return 'Importação'
  if (s.includes('google')) return 'Google'
  if (s.includes('meta') || s.includes('facebook') || s.includes('instagram_ad')) return 'Anúncio Meta'
  return (raw || '').trim().replace(/^./, c => c.toUpperCase())
}

export type LeadSourceReturnRow = { source: string; count: number; revenue_cents: number; commission_cents: number }

/**
 * Receita e comissão total das vendas concluídas, agrupadas pela origem do
 * lead que virou aquela venda (travel_sales.contato_id → contatos.source).
 * Só faz sentido pro nicho viagens (onde existe comissão por venda) — pros
 * demais nichos ainda não há um critério de retorno definido, então retorna
 * `null` (diferente de "viagens sem dado ainda", que retorna lista vazia) —
 * o caller decide o que mostrar no lugar.
 */
export async function getLeadSourceReturns(orgId: string, since: Date, limit = 8): Promise<LeadSourceReturnRow[] | null> {
  const supabase = createClient()
  if (!(await isOrgTravelNiche(supabase, orgId))) return null

  const { data } = await supabase
    .from('travel_sales')
    .select('contato_id, total_cents, commission_cents, created_at, status')
    .eq('organization_id', orgId)
    .neq('status', 'cancelado')
    .gte('created_at', since.toISOString())

  const rows = (data || []) as any[]
  const contatoIds = Array.from(new Set(rows.map(r => r.contato_id).filter(Boolean)))
  if (contatoIds.length === 0) return []

  const { data: contatos } = await supabase
    .from('contatos')
    .select('id, source')
    .in('id', contatoIds)
  const sourceByContato = new Map((contatos || []).map(c => [c.id, c.source as string | null]))

  const bySource = new Map<string, LeadSourceReturnRow>()
  for (const r of rows) {
    const label = classifyLeadSource(r.contato_id ? sourceByContato.get(r.contato_id) ?? null : null)
    const cur = bySource.get(label) || { source: label, count: 0, revenue_cents: 0, commission_cents: 0 }
    cur.count += 1
    cur.revenue_cents += r.total_cents || 0
    cur.commission_cents += r.commission_cents || 0
    bySource.set(label, cur)
  }

  return Array.from(bySource.values())
    .sort((a, b) => b.commission_cents - a.commission_cents)
    .slice(0, limit)
}
