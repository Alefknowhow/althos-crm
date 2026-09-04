'use server'

import { createClient } from '@/lib/supabase/server'
import { isOrgTravelNiche } from '@/lib/dashboard/sales-source'

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

/* -------- NPS (Net Promoter Score) -------- */

export type NpsResult = {
  score: number
  promoters: number
  passives: number
  detractors: number
  responses: number
}

/** NPS clássico: %promotores (9-10) menos %detratores (0-6), sobre as
 *  respostas já registradas (manual ou via pesquisa disparada). Sem
 *  respostas ainda, `score` fica 0 mas isso não significa "neutro" — o
 *  widget deve checar `responses === 0` pra mostrar "sem dados" em vez de
 *  um NPS zerado enganoso. */
export async function getNpsScore(orgId: string): Promise<NpsResult> {
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('nps_score')
    .eq('organization_id', orgId)
    .not('nps_score', 'is', null)

  const scores = (data || []).map((r: any) => r.nps_score as number)
  const responses = scores.length
  const promoters = scores.filter(s => s >= 9).length
  const detractors = scores.filter(s => s <= 6).length
  const passives = responses - promoters - detractors
  const score = responses > 0 ? Math.round(((promoters - detractors) / responses) * 100) : 0

  return { score, promoters, passives, detractors, responses }
}
