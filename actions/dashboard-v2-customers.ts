/**
 * Dashboard v2 — base de clientes (aba Clientes). Casa do LTV.
 *
 * Sem 'use server' (server-only). Uma única leitura do histórico de vendas
 * da org (niche-aware via fetchDetailedSales) alimenta todos os
 * indicadores da aba — segmentação, LTV por segmento, evolução, VIP e em
 * risco — em vez de várias leituras repetidas da mesma tabela.
 *
 * Segmentos (critério objetivo, sem classificação manual):
 *   dormente   = última compra há 180+ dias
 *   risco      = última compra há 90-179 dias
 *   vip        = top 10% de LTV entre os demais
 *   recorrente = 2+ compras
 *   novo       = primeira compra nos últimos 30 dias
 *   ativo      = demais (1 compra, entre 30 e 89 dias)
 */

import { createClient } from '@/lib/supabase/server'
import { fetchDetailedSales } from './dashboard-v2-sales'
import { lastNMonths, monthLabel } from '@/lib/dashboard/format'

const DAY = 86_400_000

export const SEGMENTS = ['novo', 'ativo', 'recorrente', 'vip', 'dormente', 'risco'] as const
export type Segment = (typeof SEGMENTS)[number]
export const SEGMENT_LABEL: Record<Segment, string> = {
  novo: 'Novo', ativo: 'Ativo', recorrente: 'Recorrente', vip: 'VIP', dormente: 'Dormente', risco: 'Em risco',
}

export type CustomerRow = {
  contato_id: string
  name: string
  ltv_cents: number
  purchases: number
  last_purchase: string
  days_since: number
  last_item: string | null
  seller_id: string | null
  assigned_to: string | null
  last_interaction_at: string | null
  segment: Segment
  risk?: 'alto' | 'medio' | 'baixo'
}

export type CustomerBase = {
  totalCustomers: number
  active: number
  newInPeriod: number
  repurchasePct: number | null
  avgLtvCents: number
  segments: Record<Segment, { count: number; avgLtvCents: number }>
  evolution: { month: string; label: string; novos: number; recorrentes: number; reativados: number }[]
  vip: CustomerRow[]
  atRisk: CustomerRow[]
}

export async function getCustomerBase(orgId: string, since: Date): Promise<CustomerBase> {
  const supabase = createClient()
  const sales = await fetchDetailedSales(orgId, {})
  const now = Date.now()

  type Acc = { total: number; dates: number[]; lastItem: string | null; lastSeller: string | null; last: number }
  const by = new Map<string, Acc>()
  for (const s of sales) {
    if (!s.contato_id) continue
    const t = new Date(s.date).getTime()
    const a = by.get(s.contato_id) || { total: 0, dates: [], lastItem: null, lastSeller: null, last: 0 }
    a.total += s.amount_cents
    a.dates.push(t)
    if (t >= a.last) { a.last = t; a.lastItem = s.item; a.lastSeller = s.seller_id }
    by.set(s.contato_id, a)
  }

  const entries = Array.from(by.entries()).map(([id, a]) => ({ id, ...a, dates: a.dates.sort((x, y) => x - y) }))
  const nonLapsed = entries.filter(e => now - e.last < 90 * DAY).sort((a, b) => b.total - a.total)
  const vipCut = nonLapsed.length > 0 ? nonLapsed[Math.max(0, Math.ceil(nonLapsed.length * 0.1) - 1)].total : Infinity

  const segOf = (e: (typeof entries)[number]): Segment => {
    const days = (now - e.last) / DAY
    if (days >= 180) return 'dormente'
    if (days >= 90) return 'risco'
    if (e.total >= vipCut && e.total > 0) return 'vip'
    if (e.dates.length >= 2) return 'recorrente'
    if ((now - e.dates[0]) / DAY <= 30) return 'novo'
    return 'ativo'
  }

  const segAgg = Object.fromEntries(SEGMENTS.map(s => [s, { count: 0, sum: 0 }])) as Record<Segment, { count: number; sum: number }>
  const withSeg = entries.map(e => {
    const seg = segOf(e)
    segAgg[seg].count += 1
    segAgg[seg].sum += e.total
    return { ...e, seg }
  })

  // Evolução mensal: quem comprou no mês, classificado pela compra anterior.
  const months = lastNMonths(12)
  const evo = new Map(months.map(m => [m, { novos: new Set<string>(), recorrentes: new Set<string>(), reativados: new Set<string>() }]))
  for (const e of entries) {
    e.dates.forEach((t, i) => {
      const d = new Date(t)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const bucket = evo.get(key)
      if (!bucket) return
      if (i === 0) bucket.novos.add(e.id)
      else if (t - e.dates[i - 1] > 180 * DAY) bucket.reativados.add(e.id)
      else bucket.recorrentes.add(e.id)
    })
  }
  const evolution = months.map(m => {
    const b = evo.get(m)!
    // Um cliente conta uma vez por mês, na categoria "mais nova" (novo > reativado > recorrente).
    const rec = Array.from(b.recorrentes).filter(id => !b.novos.has(id) && !b.reativados.has(id)).length
    const reat = Array.from(b.reativados).filter(id => !b.novos.has(id)).length
    return { month: m, label: monthLabel(m), novos: b.novos.size, recorrentes: rec, reativados: reat }
  })

  // Nomes/responsável/última interação só de quem entra nas listas.
  const vipIds = withSeg.filter(e => e.seg === 'vip').sort((a, b) => b.total - a.total).slice(0, 20)
  const riskIds = withSeg.filter(e => e.seg === 'risco').sort((a, b) => b.total - a.total).slice(0, 30)
  const need = Array.from(new Set([...vipIds, ...riskIds].map(e => e.id)))
  const info = new Map<string, { name: string; assigned_to: string | null; last_activity_at: string | null }>()
  for (let i = 0; i < need.length; i += 300) {
    const { data } = await supabase
      .from('contatos')
      .select('id, name, assigned_to, last_activity_at')
      .eq('organization_id', orgId)
      .in('id', need.slice(i, i + 300))
    for (const c of (data || []) as any[]) info.set(c.id, { name: c.name || 'Sem nome', assigned_to: c.assigned_to ?? null, last_activity_at: c.last_activity_at ?? null })
  }

  const ltvs = entries.map(e => e.total).sort((a, b) => a - b)
  const p75 = ltvs.length > 0 ? ltvs[Math.floor(ltvs.length * 0.75)] : 0
  const toRow = (e: (typeof withSeg)[number]): CustomerRow | null => {
    const c = info.get(e.id)
    if (!c) return null // contato removido/de outra org — não exibe
    const days = Math.floor((now - e.last) / DAY)
    return {
      contato_id: e.id,
      name: c.name,
      ltv_cents: e.total,
      purchases: e.dates.length,
      last_purchase: new Date(e.last).toISOString(),
      days_since: days,
      last_item: e.lastItem,
      seller_id: e.lastSeller,
      assigned_to: c.assigned_to,
      last_interaction_at: c.last_activity_at,
      segment: e.seg,
      risk: e.seg === 'risco' ? (days >= 150 || e.total >= p75 ? 'alto' : days >= 120 ? 'medio' : 'baixo') : undefined,
    }
  }

  const total = entries.length
  const repeat = entries.filter(e => e.dates.length >= 2).length
  return {
    totalCustomers: total,
    active: segAgg.novo.count + segAgg.ativo.count + segAgg.recorrente.count + segAgg.vip.count,
    newInPeriod: entries.filter(e => e.dates[0] >= since.getTime()).length,
    repurchasePct: total > 0 ? (repeat / total) * 100 : null,
    avgLtvCents: total > 0 ? Math.round(entries.reduce((a, e) => a + e.total, 0) / total) : 0,
    segments: Object.fromEntries(SEGMENTS.map(s => [s, { count: segAgg[s].count, avgLtvCents: segAgg[s].count > 0 ? Math.round(segAgg[s].sum / segAgg[s].count) : 0 }])) as CustomerBase['segments'],
    evolution,
    vip: vipIds.map(toRow).filter((r): r is CustomerRow => r !== null),
    atRisk: riskIds.map(toRow).filter((r): r is CustomerRow => r !== null)
      .sort((a, b) => ({ alto: 0, medio: 1, baixo: 2 }[a.risk!] - { alto: 0, medio: 1, baixo: 2 }[b.risk!]) || b.ltv_cents - a.ltv_cents),
  }
}
