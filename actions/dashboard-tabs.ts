'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchNormalizedSales, isOrgTravelNiche } from '@/lib/dashboard/sales-source'
import { getSellersRanking } from '@/actions/dashboard'

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

/* -------- Carteira de clientes (LTV, cidade, VIP, em risco) -------- */

type SaleWithContact = { contato_id: string | null; amount_cents: number; sale_date: string }

async function fetchCompletedSalesWithContact(orgId: string): Promise<SaleWithContact[]> {
  const supabase = createClient()
  if (await isOrgTravelNiche(supabase, orgId)) {
    const { data } = await supabase
      .from('travel_sales')
      .select('contato_id, total_cents, created_at, status')
      .eq('organization_id', orgId)
      .neq('status', 'cancelado')
    return ((data || []) as any[]).map(r => ({ contato_id: r.contato_id, amount_cents: r.total_cents || 0, sale_date: r.created_at }))
  }
  const { data } = await supabase
    .from('sales')
    .select('contato_id, amount_cents, sale_date, status')
    .eq('organization_id', orgId)
    .neq('status', 'cancelled')
  return ((data || []) as any[]).map(r => ({ contato_id: r.contato_id, amount_cents: r.amount_cents || 0, sale_date: r.sale_date }))
}

export type CustomerLTV = { avgLtvCents: number; customersWithSales: number }

/** LTV médio = receita total por cliente (todas as vendas concluídas, histórico completo), média entre clientes com ao menos 1 venda. */
export async function getCustomerLTV(orgId: string): Promise<CustomerLTV> {
  const rows = await fetchCompletedSalesWithContact(orgId)
  const byCustomer = new Map<string, number>()
  for (const r of rows) {
    if (!r.contato_id) continue
    byCustomer.set(r.contato_id, (byCustomer.get(r.contato_id) || 0) + r.amount_cents)
  }
  const totals = Array.from(byCustomer.values())
  const avgLtvCents = totals.length > 0 ? Math.round(totals.reduce((a, v) => a + v, 0) / totals.length) : 0
  return { avgLtvCents, customersWithSales: totals.length }
}

export type CityRow = { city: string; customers: number }

/** Clientes ativos agrupados por cidade — usa contatos.city, já existente e nunca agregado até então. */
export async function getCustomersByCity(orgId: string, limit = 8): Promise<CityRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('city')
    .eq('organization_id', orgId)
    .eq('status', 'cliente')
    .not('city', 'is', null)

  const byCity = new Map<string, number>()
  for (const r of data || []) {
    const city = (r.city || '').trim()
    if (!city) continue
    byCity.set(city, (byCity.get(city) || 0) + 1)
  }
  return Array.from(byCity.entries())
    .map(([city, customers]) => ({ city, customers }))
    .sort((a, b) => b.customers - a.customers)
    .slice(0, limit)
}

export type VipCustomerRow = { contato_id: string; name: string; total_cents: number }

/** Clientes VIP = top N por valor total histórico comprado (critério objetivo, sem campo de classificação manual). */
export async function getVipCustomers(orgId: string, limit = 5): Promise<VipCustomerRow[]> {
  const supabase = createClient()
  const rows = await fetchCompletedSalesWithContact(orgId)
  const byCustomer = new Map<string, number>()
  for (const r of rows) {
    if (!r.contato_id) continue
    byCustomer.set(r.contato_id, (byCustomer.get(r.contato_id) || 0) + r.amount_cents)
  }
  const topIds = Array.from(byCustomer.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
  if (topIds.length === 0) return []

  const { data: contatos } = await supabase
    .from('contatos')
    .select('id, name')
    .in('id', topIds.map(([id]) => id))
  const nameById = new Map((contatos || []).map(c => [c.id, c.name]))

  return topIds.map(([contato_id, total_cents]) => ({
    contato_id,
    name: nameById.get(contato_id) || 'Cliente removido',
    total_cents,
  }))
}

export type AtRiskCustomerRow = { contato_id: string; name: string; days_since_last_sale: number }

/** Clientes em risco = clientes (status='cliente') sem nenhuma compra nos últimos N dias, ordenados pelo mais tempo parado. */
export async function getAtRiskCustomers(orgId: string, thresholdDays = 90, limit = 8): Promise<AtRiskCustomerRow[]> {
  const supabase = createClient()
  const rows = await fetchCompletedSalesWithContact(orgId)
  const lastSaleByCustomer = new Map<string, string>()
  for (const r of rows) {
    if (!r.contato_id) continue
    const prev = lastSaleByCustomer.get(r.contato_id)
    if (!prev || r.sale_date > prev) lastSaleByCustomer.set(r.contato_id, r.sale_date)
  }
  if (lastSaleByCustomer.size === 0) return []

  const { data: contatos } = await supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('status', 'cliente')
    .in('id', Array.from(lastSaleByCustomer.keys()))

  const now = Date.now()
  const atRisk: AtRiskCustomerRow[] = []
  for (const c of contatos || []) {
    const lastSale = lastSaleByCustomer.get(c.id)
    if (!lastSale) continue
    const days = Math.floor((now - new Date(lastSale).getTime()) / 86_400_000)
    if (days >= thresholdDays) atRisk.push({ contato_id: c.id, name: c.name, days_since_last_sale: days })
  }
  return atRisk.sort((a, b) => b.days_since_last_sale - a.days_since_last_sale).slice(0, limit)
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

/**
 * Mensagens respondidas pela IA = whatsapp_messages onde a IA de fato
 * mandou a resposta sozinha. `sent_by_name = 'IA'` já era gravado pelo
 * atendente automático (lib/inngest/whatsapp-inbound.ts) — não precisou de
 * coluna nova, só nunca tinha virado métrica de dashboard.
 */
export async function getAiAnsweredCount(orgId: string, since: Date): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('direction', 'outbound')
    .eq('sent_by_name', 'IA')
    .gte('created_at', since.toISOString())
  return count || 0
}

/* -------- Tempo/taxa de resposta (WhatsApp) -------- */

export type ResponseMetrics = { avgResponseMinutes: number | null; responseRatePct: number | null; answeredCount: number; inboundCount: number }

/**
 * Tempo médio de resposta = tempo entre uma mensagem inbound e a próxima
 * outbound na mesma conversa. Taxa de resposta = % de mensagens inbound que
 * tiveram alguma outbound depois delas, na janela analisada.
 * whatsapp_messages.direction/created_at já existiam — não precisou de
 * nenhuma instrumentação nova, só nunca tinha sido agregado.
 */
export async function getResponseMetrics(orgId: string, since: Date, limit = 5000): Promise<ResponseMetrics> {
  const supabase = createClient()
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('conversation_id, direction, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', since.toISOString())
    .order('conversation_id', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  const byConversation = new Map<string, { direction: string; created_at: string }[]>()
  for (const m of data || []) {
    const list = byConversation.get(m.conversation_id) || []
    list.push({ direction: m.direction, created_at: m.created_at })
    byConversation.set(m.conversation_id, list)
  }

  let inboundCount = 0
  let answeredCount = 0
  const responseMinutes: number[] = []

  for (const msgs of Array.from(byConversation.values())) {
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].direction !== 'inbound') continue
      inboundCount++
      const next = msgs.slice(i + 1).find((m: { direction: string }) => m.direction === 'outbound')
      if (next) {
        answeredCount++
        const diffMin = (new Date(next.created_at).getTime() - new Date(msgs[i].created_at).getTime()) / 60_000
        responseMinutes.push(diffMin)
      }
    }
  }

  return {
    avgResponseMinutes: responseMinutes.length > 0
      ? Math.round(responseMinutes.reduce((a, v) => a + v, 0) / responseMinutes.length)
      : null,
    responseRatePct: inboundCount > 0 ? Math.round((answeredCount / inboundCount) * 100) : null,
    answeredCount,
    inboundCount,
  }
}

/* -------- Motivos de perda -------- */

export type LossReasonRow = { reason: string; count: number }

/**
 * Motivos de perda = contatos.close_reason (texto livre, preenchido no
 * diálogo de mover um lead pra etapa "perdida"/"desqualificada" —
 * KanbanBoard.tsx::LostMoveDialog) agrupado por texto exato
 * (case-insensitive, trim). Não é uma taxonomia fixa — como o campo é
 * livre, motivos parecidos escritos diferente ("sem resposta" vs "Sem
 * resposta do lead") não se juntam. Ainda assim é dado real, não mock.
 */
export async function getLossReasons(orgId: string, limit = 6): Promise<LossReasonRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('close_reason')
    .eq('organization_id', orgId)
    .in('deal_status', ['perdido', 'desqualificado'])
    .not('close_reason', 'is', null)

  const byReason = new Map<string, number>()
  for (const r of data || []) {
    const reason = (r.close_reason || '').trim()
    if (!reason) continue
    const key = reason.toLowerCase()
    byReason.set(key, (byReason.get(key) || 0) + 1)
  }

  // Mantém a primeira grafia encontrada como rótulo (case original), só a
  // contagem usa a chave normalizada.
  const labelByKey = new Map<string, string>()
  for (const r of data || []) {
    const reason = (r.close_reason || '').trim()
    if (!reason) continue
    const key = reason.toLowerCase()
    if (!labelByKey.has(key)) labelByKey.set(key, reason)
  }

  return Array.from(byReason.entries())
    .map(([key, count]) => ({ reason: labelByKey.get(key) || key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

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

export type TopDestinationRow = { destination: string; sales_count: number; total_cents: number }

/**
 * Destinos mais vendidos — Viagens-only (travel_sales.destination não tem
 * equivalente na tabela genérica `sales`), mesma assimetria que já existe
 * entre getTopProducts (genérico, [] pra Viagens) e este (Viagens, [] pros
 * demais nichos).
 */
export async function getTopDestinations(orgId: string, since: Date, limit = 6): Promise<TopDestinationRow[]> {
  const supabase = createClient()
  if (!(await isOrgTravelNiche(supabase, orgId))) return []

  const { data } = await supabase
    .from('travel_sales')
    .select('destination, total_cents, created_at, status')
    .eq('organization_id', orgId)
    .neq('status', 'canceled')
    .gte('created_at', since.toISOString())
    .not('destination', 'is', null)

  const byDestination = new Map<string, { count: number; total: number }>()
  for (const r of (data || []) as any[]) {
    const dest = (r.destination as string)?.trim()
    if (!dest) continue
    const cur = byDestination.get(dest) || { count: 0, total: 0 }
    cur.count += 1
    cur.total += r.total_cents || 0
    byDestination.set(dest, cur)
  }

  return Array.from(byDestination.entries())
    .map(([destination, v]) => ({ destination, sales_count: v.count, total_cents: v.total }))
    .sort((a, b) => b.total_cents - a.total_cents)
    .slice(0, limit)
}
