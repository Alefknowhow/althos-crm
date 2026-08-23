'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { fetchNormalizedSales } from '@/lib/dashboard/sales-source'

/**
 * Vertical Agências de Tráfego — Etapa 2, Fase C (Dashboard). Só calcula
 * métricas com fonte de dado real hoje (receita/vendas via
 * fetchNormalizedSales, já niche-aware; clientes via contatos). MRR,
 * churn, investimento em mídia, ROAS, margem e clientes-abaixo-da-meta
 * NÃO têm nenhuma fonte no projeto ainda (sem conceito de contrato
 * recorrente, meta por cliente ou rastreio de gasto em mídia) — por isso
 * não são calculados aqui; a UI mostra esses como estado vazio explicado
 * em vez de inventar número.
 */

export type TrafegoDashboardMetrics = {
  revenueCents: number
  salesCount: number
  activeClients: number
  newClients: number
  leadsGenerated: number
  /** false = sem módulo Tráfego conectado ainda (investimento/ROAS). */
  hasMediaData: boolean
  /** false = sem conceito de meta por cliente ainda. */
  hasGoalData: boolean
}

const EMPTY_METRICS: TrafegoDashboardMetrics = {
  revenueCents: 0, salesCount: 0, activeClients: 0, newClients: 0, leadsGenerated: 0,
  hasMediaData: false, hasGoalData: false,
}

export async function getTrafegoDashboardMetrics(orgSlug: string): Promise<TrafegoDashboardMetrics> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) return EMPTY_METRICS
  const supabase = createClient()

  const since30d = new Date()
  since30d.setDate(since30d.getDate() - 30)

  const [sales30d, { count: activeClients }, { count: newClients }, { count: leadsGenerated }] = await Promise.all([
    fetchNormalizedSales(supabase, org.id, { since: since30d, onlyCompleted: true }),
    supabase
      .from('contatos')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'cliente'),
    supabase
      .from('contatos')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'cliente')
      .gte('became_customer_at', since30d.toISOString()),
    supabase
      .from('contatos')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .gte('created_at', since30d.toISOString()),
  ])

  return {
    revenueCents: sales30d.reduce((a, s) => a + (s.amount_cents || 0), 0),
    salesCount: sales30d.length,
    activeClients: activeClients || 0,
    newClients: newClients || 0,
    leadsGenerated: leadsGenerated || 0,
    hasMediaData: false,
    hasGoalData: false,
  }
}
