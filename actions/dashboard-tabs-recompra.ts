'use server'

/**
 * Ranking de recompra, metas efetivas por vendedor, taxa de recompra,
 * e segmentação de clientes. Split out of actions/dashboard-tabs.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { isOrgTravelNiche } from '@/lib/dashboard/sales-source'
import { fetchCompletedSalesWithContact } from './dashboard-tabs-shared'

/* -------- Ranking de recompra (nicho viagens) -------- */

export type RecompraRow = {
  contato_id: string
  name: string
  destination: string | null
  /** Mês/ano da última viagem (departure_date da última venda), já formatado. */
  travel_month: string | null
  total_cents: number
  commission_cents: number
  last_sale_date: string
  days_since_last_sale: number
  /** payment_method da última venda (ex.: "Pix", "Cartão de crédito, Pix" quando dividido) — texto livre, direto do editor de Reservas. */
  payment_method: string | null
}
/**
 * Rank de clientes por tempo sem comprar de novo — o primeiro colocado é
 * quem está há mais dias sem fechar uma nova venda. Cada linha traz o
 * detalhe da ÚLTIMA compra (destino/mês/valor/comissão), pra dar contexto
 * imediato pra uma ligação de reativação ("call para a base"). Só existe
 * pro nicho viagens (é o único com o conceito de comissão + destino por
 * venda que esse indicador usa) — retorna `null` fora dele.
 */
export async function getRecompraRanking(orgId: string, limit = 200): Promise<RecompraRow[] | null> {
  const supabase = createClient()
  if (!(await isOrgTravelNiche(supabase, orgId))) return null

  const { data } = await supabase
    .from('travel_sales')
    .select('contato_id, destination, departure_date, total_cents, commission_cents, payment_method, created_at, status')
    .eq('organization_id', orgId)
    .neq('status', 'cancelado')
    .not('contato_id', 'is', null)

  type LastSale = { destination: string | null; departure_date: string | null; total_cents: number; commission_cents: number; payment_method: string | null; created_at: string }
  const lastSaleByContato = new Map<string, LastSale>()
  for (const r of (data || []) as any[]) {
    const prev = lastSaleByContato.get(r.contato_id)
    if (!prev || r.created_at > prev.created_at) {
      lastSaleByContato.set(r.contato_id, {
        destination: r.destination || null,
        departure_date: r.departure_date || null,
        total_cents: r.total_cents || 0,
        commission_cents: r.commission_cents || 0,
        payment_method: r.payment_method || null,
        created_at: r.created_at,
      })
    }
  }
  if (lastSaleByContato.size === 0) return []

  const { data: contatos } = await supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('status', 'cliente')
    .in('id', Array.from(lastSaleByContato.keys()))

  const now = Date.now()
  const rows: RecompraRow[] = []
  for (const c of contatos || []) {
    const last = lastSaleByContato.get(c.id)
    if (!last) continue
    const days = Math.floor((now - new Date(last.created_at).getTime()) / 86_400_000)
    rows.push({
      contato_id: c.id,
      name: c.name,
      destination: last.destination,
      travel_month: last.departure_date
        ? new Date(`${last.departure_date}T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        : null,
      total_cents: last.total_cents,
      commission_cents: last.commission_cents,
      payment_method: last.payment_method,
      last_sale_date: last.created_at,
      days_since_last_sale: days,
    })
  }
  return rows.sort((a, b) => b.days_since_last_sale - a.days_since_last_sale).slice(0, limit)
}

export type SellerGoalRow = { seller_id: string; goal_cents: number | null; is_individual: boolean }

/**
 * Meta mensal efetiva por vendedor ativo: usa `memberships.monthly_goal_cents`
 * quando preenchida; senão cai no fallback (meta da empresa ÷ nº de
 * vendedores ativos). `activeSellerIds` é quem já apareceu em conversão ou
 * negociações abertas no período — mesma definição usada no resto da aba
 * Equipe, pra não inventar um critério de "ativo" novo.
 */
export async function getEffectiveSellerGoals(
  orgId: string,
  activeSellerIds: string[],
  companyMonthlyGoalCents: number | null,
): Promise<SellerGoalRow[]> {
  if (activeSellerIds.length === 0) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('memberships')
    .select('user_id, monthly_goal_cents')
    .eq('organization_id', orgId)
    .in('user_id', activeSellerIds)

  const individualByUser = new Map((data || []).map(m => [m.user_id, m.monthly_goal_cents as number | null]))
  const fallbackCents = companyMonthlyGoalCents && activeSellerIds.length > 0
    ? Math.round(companyMonthlyGoalCents / activeSellerIds.length)
    : null

  return activeSellerIds.map(seller_id => {
    const individual = individualByUser.get(seller_id) ?? null
    return {
      seller_id,
      goal_cents: individual ?? fallbackCents,
      is_individual: individual !== null,
    }
  })
}

export type RepurchaseRate = { pct: number; repeatCustomers: number; totalCustomers: number }

/** Taxa de recompra = % de clientes (com ao menos 1 venda concluída) que
 *  compraram mais de uma vez — substitui o valor fixo "24%" que existia
 *  antes; os dados pra calcular isso de verdade já existiam
 *  (fetchCompletedSalesWithContact), só não tinha sido agregado ainda. */
export async function getRepurchaseRate(orgId: string): Promise<RepurchaseRate> {
  const rows = await fetchCompletedSalesWithContact(orgId)
  const byCustomer = new Map<string, number>()
  for (const r of rows) {
    if (!r.contato_id) continue
    byCustomer.set(r.contato_id, (byCustomer.get(r.contato_id) || 0) + 1)
  }
  const totalCustomers = byCustomer.size
  const repeatCustomers = Array.from(byCustomer.values()).filter(n => n >= 2).length
  return {
    pct: totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0,
    repeatCustomers,
    totalCustomers,
  }
}

export type CustomerSegment = 'novo' | 'ativo' | 'recorrente' | 'vip' | 'em_risco'
export type CustomerSegmentation = Record<CustomerSegment, number>

/**
 * Segmentação de clientes por comportamento de compra — critério objetivo,
 * sem campo manual de classificação:
 * - Novo: 1 compra, feita nos últimos 30 dias.
 * - Em risco: sem compra há 90+ dias (mesmo critério de getAtRiskCustomers).
 * - VIP: entre os 10% de maior LTV (mínimo 1 cliente), e não está em risco.
 * - Recorrente: 2+ compras, não é VIP nem está em risco.
 * - Ativo: 1 compra, fora da janela de "novo", não está em risco.
 */
export async function getCustomerSegmentation(orgId: string): Promise<CustomerSegmentation> {
  const rows = await fetchCompletedSalesWithContact(orgId)
  const byCustomer = new Map<string, { count: number; total: number; lastSale: string }>()
  for (const r of rows) {
    if (!r.contato_id) continue
    const cur = byCustomer.get(r.contato_id) || { count: 0, total: 0, lastSale: r.sale_date }
    cur.count += 1
    cur.total += r.amount_cents
    if (r.sale_date > cur.lastSale) cur.lastSale = r.sale_date
    byCustomer.set(r.contato_id, cur)
  }

  const entries = Array.from(byCustomer.entries())
  const vipThreshold = entries.length > 0
    ? [...entries].sort((a, b) => b[1].total - a[1].total)[Math.max(0, Math.ceil(entries.length * 0.1) - 1)][1].total
    : 0

  const now = Date.now()
  const segmentation: CustomerSegmentation = { novo: 0, ativo: 0, recorrente: 0, vip: 0, em_risco: 0 }
  for (const [, c] of entries) {
    const daysSinceLast = Math.floor((now - new Date(c.lastSale).getTime()) / 86_400_000)
    if (daysSinceLast >= 90) { segmentation.em_risco++; continue }
    if (c.total >= vipThreshold && vipThreshold > 0) { segmentation.vip++; continue }
    if (c.count >= 2) { segmentation.recorrente++; continue }
    if (daysSinceLast <= 30) { segmentation.novo++; continue }
    segmentation.ativo++
  }
  return segmentation
}
