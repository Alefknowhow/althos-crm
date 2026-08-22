'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'

export type ClientPerformanceSummary = {
  investmentCents: number
  impressions: number
  clicks: number
  ctr: number | null
  cpcCents: number | null
  cpmCents: number | null
  salesCount: number
  revenueCents: number
  roas: number | null
}

export type ClientPerformanceRow = {
  contatoId: string
  name: string
  source: string | null
  salesCount: number
  revenueCents: number
}

export type SourcePerformanceRow = {
  source: string
  salesCount: number
  revenueCents: number
}

export type TrafegoPerformance = {
  byClient: ClientPerformanceRow[]
  bySource: SourcePerformanceRow[]
}

/**
 * Vertical Agências de Tráfego — Etapa 2, Fase H. Performance real (vendas
 * dos últimos 30d, agrupadas por cliente e por origem do lead) — sem
 * ROAS/CAC (dependem de investimento em mídia, que não existe como dado
 * hoje; ver TrafegoTab.tsx pros mesmos estados "—" explicados).
 */
export async function getTrafegoPerformance(orgSlug: string): Promise<TrafegoPerformance> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const since30d = new Date()
  since30d.setDate(since30d.getDate() - 30)

  const { data: sales } = await supabase
    .from('sales')
    .select('amount_cents, contato_id, leads(id, name, source)')
    .eq('organization_id', org.id)
    .eq('status', 'completed')
    .gte('sale_date', since30d.toISOString().slice(0, 10))

  const byClientMap = new Map<string, ClientPerformanceRow>()
  const bySourceMap = new Map<string, SourcePerformanceRow>()

  for (const row of (sales || []) as any[]) {
    const lead = row.leads
    const amount = row.amount_cents || 0

    if (row.contato_id) {
      const existing = byClientMap.get(row.contato_id)
      if (existing) {
        existing.salesCount += 1
        existing.revenueCents += amount
      } else {
        byClientMap.set(row.contato_id, {
          contatoId: row.contato_id,
          name: lead?.name || 'Sem nome',
          source: lead?.source || null,
          salesCount: 1,
          revenueCents: amount,
        })
      }
    }

    const sourceKey = lead?.source || 'Sem origem'
    const existingSource = bySourceMap.get(sourceKey)
    if (existingSource) {
      existingSource.salesCount += 1
      existingSource.revenueCents += amount
    } else {
      bySourceMap.set(sourceKey, { source: sourceKey, salesCount: 1, revenueCents: amount })
    }
  }

  return {
    byClient: Array.from(byClientMap.values()).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10),
    bySource: Array.from(bySourceMap.values()).sort((a, b) => b.revenueCents - a.revenueCents),
  }
}

/**
 * Etapa 3 (Agent Layer) — performance de UM cliente específico, num
 * intervalo de datas arbitrário: investimento/impressões/cliques (das
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

  const accountIds = (accounts || []).map(a => a.id)
  if (accountIds.length > 0) {
    const { data: campaigns } = await supabase
      .from('campaigns').select('id').eq('organization_id', org.id).in('ad_account_id', accountIds)
    const campaignIds = (campaigns || []).map(c => c.id)
    if (campaignIds.length > 0) {
      const { data: metrics } = await supabase
        .from('campaign_metrics_daily')
        .select('impressions, clicks, spend_cents')
        .eq('organization_id', org.id)
        .in('campaign_id', campaignIds)
        .gte('date', fromStr)
        .lte('date', toStr)
      for (const m of metrics || []) {
        investmentCents += m.spend_cents || 0
        impressions += m.impressions || 0
        clicks += m.clicks || 0
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
    salesCount,
    revenueCents,
    roas: investmentCents > 0 ? revenueCents / investmentCents : null,
  }
}
