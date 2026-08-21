'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'

/**
 * Vertical Imobiliárias — Fase 5: Dashboard/relatórios. Todas as
 * métricas vêm de dado real já existente (properties, property_visits,
 * property_proposals, property_deals, financial_entries) — sem
 * placeholder/mock, mesma regra do dashboard genérico e da aba Clínica
 * (actions/dashboard-clinic.ts).
 */

export type ImoveisDashboardMetrics = {
  availableCount: number
  closedCount30d: number
  visitsUpcoming7d: number
  pendingCommissionCents: number
  proposalsByStatus: { label: string; value: number; valueLabel: string }[]
  propertiesByCity: { label: string; value: number; valueLabel: string }[]
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviada', viewed: 'Vista', won: 'Aceita', lost: 'Recusada', expired: 'Expirada',
}

export async function getImoveisDashboardMetrics(orgSlug: string): Promise<ImoveisDashboardMetrics> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: availableCount },
    { count: closedCount30d },
    { count: visitsUpcoming7d },
    { data: pendingCommissions },
    { data: proposals30d },
    { data: availableProperties },
  ] = await Promise.all([
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'disponivel'),
    supabase
      .from('property_deals')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'aberto')
      .gte('closed_at', since30d),
    supabase
      .from('property_visits')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .in('status', ['agendada', 'confirmada'])
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', next7d),
    supabase
      .from('financial_entries')
      .select('valor_cents')
      .eq('organization_id', org.id)
      .eq('status', 'pendente')
      .not('property_deal_id', 'is', null),
    supabase
      .from('property_proposals')
      .select('status')
      .eq('organization_id', org.id)
      .gte('created_at', since30d),
    supabase
      .from('properties')
      .select('city')
      .eq('organization_id', org.id)
      .eq('status', 'disponivel'),
  ])

  const pendingCommissionCents = (pendingCommissions || []).reduce((a, e) => a + (e.valor_cents || 0), 0)

  const byStatus = new Map<string, number>()
  for (const p of proposals30d || []) byStatus.set(p.status, (byStatus.get(p.status) || 0) + 1)
  const proposalsByStatus = Array.from(byStatus.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({ label: PROPOSAL_STATUS_LABELS[status] || status, value, valueLabel: `${value}` }))

  const byCity = new Map<string, number>()
  for (const p of availableProperties || []) {
    const city = (p.city as string | null)?.trim()
    if (!city) continue
    byCity.set(city, (byCity.get(city) || 0) + 1)
  }
  const propertiesByCity = Array.from(byCity.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([label, value]) => ({ label, value, valueLabel: `${value}` }))

  return {
    availableCount: availableCount || 0,
    closedCount30d: closedCount30d || 0,
    visitsUpcoming7d: visitsUpcoming7d || 0,
    pendingCommissionCents,
    proposalsByStatus,
    propertiesByCity,
  }
}
