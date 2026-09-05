'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization, requireAuth } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

export type ClientPerformanceSummary = {
  investmentCents: number
  impressions: number
  clicks: number
  ctr: number | null
  cpcCents: number | null
  cpmCents: number | null
  leads: number
  cplCents: number | null
  salesCount: number
  revenueCents: number
  roas: number | null
  cpaCents: number | null
}

/**
 * Etapa 3 (Agent Layer) — performance de UM cliente específico, num
 * intervalo de datas arbitrário: investimento/impressões/cliques/leads (das
 * campanhas vinculadas via ad_accounts.contato_id) + vendas/receita (mesma
 * fonte que getTrafegoPerformance, filtrada por contato_id). Usada pela
 * tool get_client_performance (lib/agent/tools/clients.ts), que passa um
 * client já autenticado por token (sem cookie de sessão) — por isso recebe
 * `supabase`/`orgId` já resolvidos em vez de `orgSlug`.
 */
export async function getClientPerformanceSummaryCore(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contatoId: string,
  range: { from: Date; to: Date },
): Promise<ClientPerformanceSummary> {
  const org = { id: orgId }
  const fromStr = range.from.toISOString().slice(0, 10)
  const toStr = range.to.toISOString().slice(0, 10)

  const [{ data: sales }, { data: accounts }] = await Promise.all([
    supabase
      .from('sales')
      .select('amount_cents')
      .eq('organization_id', org.id)
      .eq('contato_id', contatoId)
      .eq('status', 'completed')
      .gte('sale_date', fromStr)
      .lte('sale_date', toStr),
    supabase.from('ad_accounts').select('id').eq('organization_id', org.id).eq('contato_id', contatoId),
  ])

  const revenueCents = (sales || []).reduce((a, s) => a + (s.amount_cents || 0), 0)
  const salesCount = (sales || []).length

  let investmentCents = 0
  let impressions = 0
  let clicks = 0
  let leads = 0

  const accountIds = (accounts || []).map(a => a.id)
  if (accountIds.length > 0) {
    const { data: campaigns } = await supabase
      .from('campaigns').select('id').eq('organization_id', org.id).in('ad_account_id', accountIds)
    const campaignIds = (campaigns || []).map(c => c.id)
    if (campaignIds.length > 0) {
      const { data: metrics } = await supabase
        .from('campaign_metrics_daily')
        .select('impressions, clicks, spend_cents, meta_leads')
        .eq('organization_id', org.id)
        .in('campaign_id', campaignIds)
        .gte('date', fromStr)
        .lte('date', toStr)
      for (const m of metrics || []) {
        investmentCents += m.spend_cents || 0
        impressions += m.impressions || 0
        clicks += m.clicks || 0
        leads += (m as any).meta_leads || 0
      }
    }
  }

  return {
    investmentCents,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : null,
    cpcCents: clicks > 0 ? investmentCents / clicks : null,
    cpmCents: impressions > 0 ? (investmentCents / impressions) * 1000 : null,
    leads,
    cplCents: leads > 0 ? investmentCents / leads : null,
    salesCount,
    revenueCents,
    roas: investmentCents > 0 ? revenueCents / investmentCents : null,
    cpaCents: salesCount > 0 ? investmentCents / salesCount : null,
  }
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return org
}

export async function getClientPerformanceSummary(
  orgSlug: string,
  contatoId: string,
  range: { from: Date; to: Date },
): Promise<ClientPerformanceSummary> {
  const org = await requireAccess(orgSlug)
  const supabase = createClient()
  return getClientPerformanceSummaryCore(supabase, org.id, contatoId, range)
}

/** Resumo do período + do período imediatamente anterior de mesma duração — pra tendência/comparação. */
export async function getClientPerformanceComparison(
  orgSlug: string,
  contatoId: string,
  range: { from: Date; to: Date },
): Promise<{ current: ClientPerformanceSummary; previous: ClientPerformanceSummary }> {
  const org = await requireAccess(orgSlug)
  const supabase = createClient()
  const durationMs = range.to.getTime() - range.from.getTime()
  const prevTo = new Date(range.from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - durationMs)

  const [current, previous] = await Promise.all([
    getClientPerformanceSummaryCore(supabase, org.id, contatoId, range),
    getClientPerformanceSummaryCore(supabase, org.id, contatoId, { from: prevFrom, to: prevTo }),
  ])
  return { current, previous }
}

/** Série diária de investimento/leads/impressões/cliques/receita de um
 *  cliente — alimenta o gráfico da Visão Geral e o painel da aba
 *  Performance (CTR/CPL/CPM são derivados a partir daqui, não guardados). */
export type ClientDailyPoint = {
  date: string
  investmentCents: number
  leads: number
  salesRevenueCents: number
  impressions: number
  clicks: number
}

export async function getClientDailySeries(
  orgSlug: string,
  contatoId: string,
  range: { from: Date; to: Date },
): Promise<ClientDailyPoint[]> {
  const org = await requireAccess(orgSlug)
  const supabase = createClient()
  const fromStr = range.from.toISOString().slice(0, 10)
  const toStr = range.to.toISOString().slice(0, 10)

  const { data: accounts } = await supabase.from('ad_accounts').select('id').eq('organization_id', org.id).eq('contato_id', contatoId)
  const accountIds = (accounts || []).map(a => a.id)

  const byDate = new Map<string, ClientDailyPoint>()
  const ensure = (d: string) => {
    let p = byDate.get(d)
    if (!p) { p = { date: d, investmentCents: 0, leads: 0, salesRevenueCents: 0, impressions: 0, clicks: 0 }; byDate.set(d, p) }
    return p
  }

  if (accountIds.length > 0) {
    const { data: campaigns } = await supabase.from('campaigns').select('id').eq('organization_id', org.id).in('ad_account_id', accountIds)
    const campaignIds = (campaigns || []).map(c => c.id)
    if (campaignIds.length > 0) {
      const { data: metrics } = await supabase
        .from('campaign_metrics_daily')
        .select('date, spend_cents, meta_leads, impressions, clicks')
        .eq('organization_id', org.id)
        .in('campaign_id', campaignIds)
        .gte('date', fromStr)
        .lte('date', toStr)
      for (const m of metrics || []) {
        const p = ensure(m.date)
        p.investmentCents += m.spend_cents || 0
        p.leads += (m as any).meta_leads || 0
        p.impressions += m.impressions || 0
        p.clicks += m.clicks || 0
      }
    }
  }

  const { data: sales } = await supabase
    .from('sales')
    .select('sale_date, amount_cents')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .eq('status', 'completed')
    .gte('sale_date', fromStr)
    .lte('sale_date', toStr)
  for (const s of sales || []) {
    if (!s.sale_date) continue
    const p = ensure(s.sale_date)
    p.salesRevenueCents += s.amount_cents || 0
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}
