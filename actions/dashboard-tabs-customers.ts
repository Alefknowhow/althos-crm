'use server'

/**
 * Carteira de clientes: LTV, por cidade, VIP, em risco.
 * Split out of actions/dashboard-tabs.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { fetchCompletedSalesWithContact } from './dashboard-tabs-shared'

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

export type CityRow = { city: string; customers: number; revenue_cents: number; commission_cents: number }

/** Clientes ativos agrupados por cidade — usa contatos.city, com receita e
 *  comissão total das vendas concluídas de cada cliente somadas por cidade
 *  (comissão só existe no nicho viagens, fica 0 nos demais). */
export async function getCustomersByCity(orgId: string, limit = 8): Promise<CityRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('id, city')
    .eq('organization_id', orgId)
    .eq('status', 'cliente')
    .not('city', 'is', null)

  const cityByContato = new Map<string, string>()
  const byCity = new Map<string, CityRow>()
  for (const r of data || []) {
    const city = (r.city || '').trim()
    if (!city) continue
    cityByContato.set(r.id, city)
    const cur = byCity.get(city) || { city, customers: 0, revenue_cents: 0, commission_cents: 0 }
    cur.customers += 1
    byCity.set(city, cur)
  }
  if (byCity.size === 0) return []

  const sales = await fetchCompletedSalesWithContact(orgId)
  for (const s of sales) {
    if (!s.contato_id) continue
    const city = cityByContato.get(s.contato_id)
    if (!city) continue
    const row = byCity.get(city)
    if (!row) continue
    row.revenue_cents += s.amount_cents
    row.commission_cents += s.commission_cents
  }

  return Array.from(byCity.values())
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
