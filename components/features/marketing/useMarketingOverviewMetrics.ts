import { useMemo } from 'react'
import type { ObjectiveGroup } from '@/lib/marketing/objective'
import { OBJECTIVE_GROUP_LABELS } from '@/lib/marketing/objective'
import type { MetricContext } from './metricRegistry'
import type { Overview } from './MarketingOverviewShared'

/**
 * Agregações derivadas de overview/campaigns (totais, série diária, gasto por
 * objetivo, comparação com período anterior) — extraído de MarketingOverview
 * (que passou do limite de 350 linhas do lint). Mesma lógica, arquivo próprio.
 */
export function useMarketingOverviewMetrics(
  overview: Overview,
  objectiveFilter: ObjectiveGroup | 'all',
  accountFilter: string | null,
  chartCampaignFilter: Set<string> | 'all',
) {
  const filteredCampaigns = overview.campaigns
    .filter(c => objectiveFilter === 'all' || c.objective_group === objectiveFilter)
    .filter(c => !accountFilter || c.ad_account_id === accountFilter)

  const filteredTotals: MetricContext = filteredCampaigns.reduce(
    (acc, c) => {
      acc.spend_cents += c.spend_cents
      acc.impressions += c.impressions
      acc.clicks += c.clicks
      acc.leads += c.leads
      acc.meta_leads += c.meta_leads
      acc.meta_messaging_started += c.meta_messaging_started
      acc.meta_link_clicks += c.meta_link_clicks
      acc.meta_landing_page_views += c.meta_landing_page_views
      acc.meta_purchases += c.meta_purchases
      acc.meta_purchase_value_cents += c.meta_purchase_value_cents
      acc.won_deals += c.won_deals
      acc.revenue_cents += c.revenue_cents
      return acc
    },
    { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, meta_leads: 0, meta_messaging_started: 0, meta_link_clicks: 0, meta_landing_page_views: 0, meta_purchases: 0, meta_purchase_value_cents: 0, won_deals: 0, revenue_cents: 0 },
  )

  // Série diária filtrada pela conta e pelas campanhas marcadas na tabela
  // (o objetivo não afeta o gráfico — não dá pra reagregar por objetivo
  // sem reprocessar por campanha/dia, fora de escopo).
  const filteredTimeSeries = useMemo(() => {
    const byDate = new Map<string, MetricContext & { date: string }>()
    for (const p of overview.timeSeries) {
      if (accountFilter && p.ad_account_id !== accountFilter) continue
      if (chartCampaignFilter !== 'all' && !chartCampaignFilter.has(p.campaign_id)) continue
      const cur = byDate.get(p.date) || {
        date: p.date, spend_cents: 0, impressions: 0, clicks: 0, leads: 0,
        meta_leads: 0, meta_messaging_started: 0, meta_link_clicks: 0, meta_landing_page_views: 0, meta_purchases: 0, meta_purchase_value_cents: 0,
        won_deals: 0, revenue_cents: 0,
      }
      cur.spend_cents += p.spend_cents
      cur.impressions += p.impressions
      cur.clicks += p.clicks
      cur.leads += p.leads
      cur.meta_leads += p.meta_leads
      cur.meta_messaging_started += p.meta_messaging_started
      cur.meta_link_clicks += p.meta_link_clicks
      cur.meta_landing_page_views += p.meta_landing_page_views
      cur.meta_purchases += p.meta_purchases
      cur.meta_purchase_value_cents += p.meta_purchase_value_cents
      byDate.set(p.date, cur)
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [overview.timeSeries, accountFilter, chartCampaignFilter])

  // Investimento por objetivo (Leads/Mensagens/Tráfego/Vendas/Reconhecimento)
  // — calculado a partir das campanhas já filtradas por conta/objetivo,
  // pra bater com o resto do painel (não usa overview.byObjective, que é
  // agregado sem filtro de conta).
  const byObjectiveData = useMemo(() => {
    const byGroup = new Map<string, number>()
    for (const c of filteredCampaigns) {
      byGroup.set(c.objective_group, (byGroup.get(c.objective_group) || 0) + c.spend_cents)
    }
    return Array.from(byGroup.entries())
      .map(([group, cents]) => ({ name: OBJECTIVE_GROUP_LABELS[group as ObjectiveGroup] || group, value: cents }))
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [filteredCampaigns])

  // Totais do período anterior, filtrados pela MESMA conta/objetivo que
  // filteredTotals — sem isso a comparação misturava contas/objetivos que
  // nem estão selecionados na tela, e o número não batia com nada visível.
  const { previousFilteredTotals, hasPreviousData } = useMemo(() => {
    const matching = overview.previousCampaigns
      .filter(c => objectiveFilter === 'all' || c.objective_group === objectiveFilter)
      .filter(c => !accountFilter || c.ad_account_id === accountFilter)
    const totals = matching.reduce(
      (acc, c) => {
        acc.spend_cents += c.spend_cents
        acc.impressions += c.impressions
        acc.clicks += c.clicks
        acc.meta_leads += c.meta_leads
        acc.meta_messaging_started += c.meta_messaging_started
        acc.meta_purchases += c.meta_purchases
        return acc
      },
      { spend_cents: 0, impressions: 0, clicks: 0, meta_leads: 0, meta_messaging_started: 0, meta_purchases: 0 },
    )
    return { previousFilteredTotals: totals, hasPreviousData: matching.length > 0 }
  }, [overview.previousCampaigns, objectiveFilter, accountFilter])

  return { filteredCampaigns, filteredTotals, filteredTimeSeries, byObjectiveData, previousFilteredTotals, hasPreviousData }
}
