import type { Overview } from '@/components/features/marketing/MarketingOverviewShared'

/**
 * Restringe um Overview (getMarketingOverview, que agrega TODAS as contas
 * da org) às contas de um provider específico — usado pelas abas Meta Ads /
 * Google Ads (issue #24), que devem mostrar só o que é daquele provider,
 * inclusive nos totais agregados (não só na lista de contas do seletor).
 * `getMarketingOverview` continua sendo chamado uma única vez sem filtro —
 * isso só recorta o resultado já em memória, sem query extra.
 */
export function filterOverviewByProvider(overview: Overview, accountIds: Set<string>): Overview {
  const campaigns = overview.campaigns.filter(c => accountIds.has(c.ad_account_id))
  const timeSeries = overview.timeSeries.filter(p => accountIds.has(p.ad_account_id))
  const previousCampaigns = overview.previousCampaigns.filter(c => c.ad_account_id !== null && accountIds.has(c.ad_account_id))

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.spend_cents += c.spend_cents
      acc.impressions += c.impressions
      acc.clicks += c.clicks
      acc.leads += c.leads
      acc.won_deals += c.won_deals
      acc.revenue_cents += c.revenue_cents
      return acc
    },
    { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, won_deals: 0, revenue_cents: 0 },
  )

  return { ...overview, campaigns, timeSeries, previousCampaigns, totals }
}
