'use server'

import { createClient } from '@/lib/supabase/server'

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
